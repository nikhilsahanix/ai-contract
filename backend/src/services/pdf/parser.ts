// backend\src\services\pdf\parser.ts

import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { logger } from "../../lib/logger.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PageBlock {
  pageNumber: number;
  text: string;
  charCount: number;
  hasContent: boolean;
}

export interface ExtractionResult {
  text: string;
  pageCount: number;
  method: "digital" | "ocr" | "docx";
  confidence: number;       // 0–1
  structuredPages: PageBlock[];
  warnings: string[];
  charCount: number;
  estimatedTokens: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

// A real contract page has at least this many characters on average.
// Below this → likely scanned or corrupted.
const MIN_CHARS_PER_PAGE = 150;

// Claude's safe context ceiling (leave buffer for prompt + response)
const MAX_SAFE_CHARS = 90_000;

// ─── Main entry point ──────────────────────────────────────────────────────

export async function extractContractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  logger.info({ mimeType, sizeBytes: buffer.length }, "Starting text extraction");

  if (mimeType.includes("wordprocessingml") || mimeType.includes("docx")) {
    return extractDocx(buffer);
  }

  // Try digital PDF extraction first
  const digital = await tryDigitalPDF(buffer);

  // Quality gate: if average chars per page is too low → scanned document
  const avgCharsPerPage = digital.pageCount > 0
    ? digital.charCount / digital.pageCount
    : 0;

  if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
    logger.warn(
      { avgCharsPerPage, pageCount: digital.pageCount },
      "Low character density — attempting OCR fallback"
    );
    try {
      return await tryOCR(buffer, digital.pageCount);
    } catch (ocrErr) {
      logger.error({ ocrErr }, "OCR failed — falling back to partial digital extraction");
      // Return digital result with a warning rather than failing completely
      digital.warnings.push(
        "Document appears to be scanned. OCR failed. Analysis may be incomplete."
      );
      digital.confidence = Math.min(digital.confidence, 0.3);
      return digital;
    }
  }

  return digital;
}

// ─── Digital PDF extraction ────────────────────────────────────────────────

async function tryDigitalPDF(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];

  let raw: Awaited<ReturnType<typeof pdfParse>>;
  try {
    raw = await pdfParse(buffer, {
      // Preserve page structure by capturing page text separately
      pagerender: renderPageText,
    });
  } catch (err) {
    throw new Error(`PDF parse failed: ${(err as Error).message}`);
  }

  const pageCount = raw.numpages || 1;
  const rawText   = raw.text || "";

  // Clean the raw extracted text
  const cleaned = cleanExtractedText(rawText);

  // Build per-page blocks from the raw text
  // pdf-parse doesn't give per-page text easily, so we split by form feeds
  const pages = splitIntoPages(cleaned, pageCount);

  // Confidence heuristics
  let confidence = 1.0;
  const avgChars = cleaned.length / pageCount;

  if (avgChars < MIN_CHARS_PER_PAGE) {
    confidence *= 0.3;
    warnings.push("Very low text density — document may be scanned or image-based.");
  } else if (avgChars < 300) {
    confidence *= 0.6;
    warnings.push("Below-average text density — some pages may be scanned.");
  }

  // Check for garbled text (high ratio of non-ASCII = bad encoding)
  const nonAsciiRatio = (cleaned.match(/[^\x00-\x7F]/g) || []).length / (cleaned.length || 1);
  if (nonAsciiRatio > 0.15) {
    confidence *= 0.7;
    warnings.push("High proportion of non-ASCII characters — encoding may be degraded.");
  }

  if (cleaned.length > MAX_SAFE_CHARS) {
    warnings.push(
      `Document is ${Math.round(cleaned.length / 1000)}k characters — ` +
      `will be analyzed in chunks for accuracy.`
    );
  }

  const result: ExtractionResult = {
    text: cleaned,
    pageCount,
    method: "digital",
    confidence: Math.max(0, Math.min(confidence, 1)),
    structuredPages: pages,
    warnings,
    charCount: cleaned.length,
    estimatedTokens: Math.round(cleaned.length / 4),
  };

  logger.info(
    {
      method: "digital",
      pageCount,
      charCount: cleaned.length,
      confidence: result.confidence,
      warnings: warnings.length,
    },
    "Digital extraction complete"
  );

  return result;
}

// Custom page renderer that preserves structure
function renderPageText(pageData: any): Promise<string> {
  const renderOptions = {
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  };
  return pageData.getTextContent(renderOptions).then((textContent: any) => {
    let lastY: number | null = null;
    let text = "";
    for (const item of textContent.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        text += "\n";
      }
      text += item.str;
      lastY = item.transform[5];
    }
    return text;
  });
}

// ─── OCR fallback (for scanned PDFs) ──────────────────────────────────────

async function tryOCR(buffer: Buffer, pageCount: number): Promise<ExtractionResult> {
  logger.info({ pageCount }, "Starting OCR extraction");
  const warnings: string[] = ["Document extracted via OCR — minor character errors may exist."];

  // Dynamically import heavy OCR deps so they don't slow startup
  const { createWorker } = await import("tesseract.js");
  const { fromBuffer }   = await import("pdf2pic");

  const converter = fromBuffer(buffer, {
    density: 200,       // 200 DPI is good balance of quality vs speed
    format: "png",
    width: 1700,
    height: 2200,
  });

  const worker = await createWorker("eng");
  const pageTexts: string[] = [];
  const structuredPages: PageBlock[] = [];

  // Process up to 50 pages (beyond that, warn and truncate)
  const maxPages = Math.min(pageCount, 50);
  if (pageCount > 50) {
    warnings.push(`Document has ${pageCount} pages — OCR limited to first 50 pages.`);
  }

  for (let i = 1; i <= maxPages; i++) {
    try {
      const page     = await converter(i, { responseType: "buffer" });
      const { data } = await worker.recognize(page.buffer as Buffer);
      const text     = cleanExtractedText(data.text);
      pageTexts.push(text);
      structuredPages.push({
        pageNumber: i,
        text,
        charCount: text.length,
        hasContent: text.length > 50,
      });
    } catch (pageErr) {
      logger.warn({ page: i, pageErr }, "OCR failed for page — skipping");
      pageTexts.push("");
      structuredPages.push({ pageNumber: i, text: "", charCount: 0, hasContent: false });
    }
  }

  await worker.terminate();

  const fullText  = pageTexts.join("\n\n--- PAGE BREAK ---\n\n");
  const charCount = fullText.length;

  // OCR confidence: based on how much text we got vs expected
  const avgChars     = charCount / maxPages;
  const confidence   = Math.min(avgChars / 500, 0.85); // OCR max confidence 0.85

  const result: ExtractionResult = {
    text: fullText,
    pageCount,
    method: "ocr",
    confidence,
    structuredPages,
    warnings,
    charCount,
    estimatedTokens: Math.round(charCount / 4),
  };

  logger.info(
    { method: "ocr", pageCount, charCount, confidence },
    "OCR extraction complete"
  );

  return result;
}

// ─── DOCX extraction ───────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];

  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    warnings.push(...result.messages.map((m: any) => `DOCX: ${m.message}`));
  }

  const cleaned   = cleanExtractedText(result.value);
  const charCount = cleaned.length;

  // Estimate page count (approx 3000 chars per page)
  const estimatedPages = Math.max(1, Math.round(charCount / 3000));

  if (charCount > MAX_SAFE_CHARS) {
    warnings.push(
      `Document is ${Math.round(charCount / 1000)}k characters — ` +
      `will be analyzed in chunks.`
    );
  }

  const extraction: ExtractionResult = {
    text: cleaned,
    pageCount: estimatedPages,
    method: "docx",
    confidence: 0.95,   // DOCX extraction is highly reliable
    structuredPages: [{
      pageNumber: 1,
      text: cleaned,
      charCount: cleaned.length,
      hasContent: cleaned.length > 100,
    }],
    warnings,
    charCount,
    estimatedTokens: Math.round(charCount / 4),
  };

  logger.info(
    { method: "docx", estimatedPages, charCount },
    "DOCX extraction complete"
  );

  return extraction;
}

// ─── Text cleaning ─────────────────────────────────────────────────────────

function cleanExtractedText(raw: string): string {
  return raw
    // Remove null bytes and control characters
    .replace(/\x00/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    // Remove repeated header/footer patterns (page numbers, firm names at top/bottom)
    // Matches lines that appear 3+ times verbatim — likely headers/footers
    .split("\n")
    .filter((line, _i, arr) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true; // keep blank lines for structure
      if (trimmed.length < 5)   return true; // keep short lines (section numbers)
      // Count occurrences — if a line appears > 3x it's probably a header/footer
      const count = arr.filter(l => l.trim() === trimmed).length;
      return count <= 3;
    })
    .join("\n")

    // Collapse 3+ consecutive blank lines to 2
    .replace(/\n{3,}/g, "\n\n")

    // Collapse excessive horizontal whitespace
    .replace(/[ \t]{4,}/g, "   ")

    // Remove page number patterns (standalone numbers, "Page X of Y")
    .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "")
    .replace(/^\s*\d+\s*$/gm, "")

    .trim();
}

// ─── Page splitting ────────────────────────────────────────────────────────

function splitIntoPages(text: string, pageCount: number): PageBlock[] {
  // pdf-parse uses form feed (\f) as page separator in some modes
  const formFeedPages = text.split("\f");

  if (formFeedPages.length === pageCount) {
    return formFeedPages.map((pageText, i) => ({
      pageNumber: i + 1,
      text: pageText.trim(),
      charCount: pageText.trim().length,
      hasContent: pageText.trim().length > 50,
    }));
  }

  // Fallback: split evenly by character count
  const charsPerPage = Math.ceil(text.length / pageCount);
  const pages: PageBlock[] = [];

  for (let i = 0; i < pageCount; i++) {
    const start    = i * charsPerPage;
    const pageText = text.slice(start, start + charsPerPage).trim();
    pages.push({
      pageNumber: i + 1,
      text: pageText,
      charCount: pageText.length,
      hasContent: pageText.length > 50,
    });
  }

  return pages;
}

// ─── Chunking for long contracts ───────────────────────────────────────────

export function chunkContractText(
  text: string,
  maxCharsPerChunk = 80_000
): string[] {
  if (text.length <= maxCharsPerChunk) return [text];

  const chunks: string[] = [];

  // Try to split at section boundaries first (ARTICLE, SECTION, numbered clauses)
  const sectionBreak = /(?=\n\s*(?:ARTICLE|SECTION|SCHEDULE|EXHIBIT|ANNEX)\s+(?:\d|[A-Z]))/i;
  const sections     = text.split(sectionBreak);

  let current = "";
  for (const section of sections) {
    if (current.length + section.length > maxCharsPerChunk && current.length > 0) {
      chunks.push(current.trim());
      current = section;
    } else {
      current += section;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If we somehow have one giant section, split by paragraph
  if (chunks.length === 1 && chunks[0].length > maxCharsPerChunk) {
    return splitByParagraph(text, maxCharsPerChunk);
  }

  logger.info({ chunks: chunks.length, totalChars: text.length }, "Contract chunked for analysis");
  return chunks;
}

function splitByParagraph(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += "\n\n" + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function getPdfPageCount(buffer: Buffer): number {
  try {
    // PDF page count is stored in the Pages dictionary as /Count N
    // We read it from the buffer as latin1 to handle binary-safe byte scanning
    const text = buffer.toString("latin1");

    // Find all /Count N occurrences — the largest one is the root page tree count
    const matches = [...text.matchAll(/\/Count\s+(\d+)/g)];
    if (matches.length === 0) return 0;

    const counts = matches.map(m => parseInt(m[1], 10));
    return Math.max(...counts);
  } catch {
    return 0; // Unreadable — let the worker handle it
  }
}

/**
 * Estimate page count for DOCX from buffer size.
 * Rough heuristic: ~6000 bytes per page (compressed XML).
 */
export function getDocxEstimatedPageCount(buffer: Buffer): number {
  return Math.max(1, Math.ceil(buffer.byteLength / 6_000));
}