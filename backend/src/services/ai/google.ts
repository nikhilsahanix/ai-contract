// backend\src\services\ai\google.ts

import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildTypeDetectionPrompt,
  buildSynthesisPrompt,
} from "./prompts.js";
import { chunkContractText } from "../pdf/parser.js";
import { AIError, type AnalysisOutput } from "./index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL        = "gemini-2.5-flash";
const TEMPERATURE  = 0;                     // deterministic output
const MAX_RETRIES  = 3;
const RETRY_DELAYS = [2000, 5000, 10000];   // ms — exponential backoff

// Gemini 2.5 Flash on AI Studio: 10 requests/minute free tier.
// We pause between chunks so multi-chunk jobs don't 429 mid-analysis.
// 6 seconds gives comfortable headroom (10 RPM = 1 req / 6s).
const INTER_CHUNK_DELAY_MS = 6_000;

// Each chunk sent to Gemini — ~50 pages of dense legal text at 1600 chars/page.
// Gemini 2.5 Flash context window is 1M tokens (~3M chars), but we keep chunks
// small so JSON output quality stays high and we avoid hitting output token limits.
const MAX_CHUNK_CHARS = 80_000;

// Prompt injection patterns to strip before sending to AI
const INJECTION_PATTERNS = [
  /<system>[\s\S]*?<\/system>/gi,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /new\s+instruction[s:]?/gi,
  /you\s+are\s+now\s+a/gi,
  /forget\s+(everything|all|your)/gi,
  /\[INST\]|\[\/INST\]/gi,
  /<<SYS>>|<\/SYS>/gi,
];

// ─── Client ──────────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

// ─── Main analysis entry point ────────────────────────────────────────────────

export async function analyzeContract(params: {
  text:                 string;
  contractType:         string;
  jurisdiction:         string | null;
  extractionConfidence: number;
}): Promise<AnalysisOutput> {
  const { text, extractionConfidence } = params;
  const startMs = Date.now();

  // 1. Sanitize — strips prompt injections but does NOT truncate.
  //    Chunking below handles size. Truncating here would silently destroy
  //    pages 25+ of every large contract before analysis even starts.
  const sanitized = sanitizeContractText(text);

  // 2. Auto-detect contract type if UNKNOWN
  let contractType = params.contractType;
  if (contractType === "UNKNOWN") {
    logger.info("Contract type unknown — running auto-detection");
    contractType = await detectContractType(sanitized);
    logger.info({ detected: contractType }, "Contract type detected");
  }

  // 3. Split into chunks if needed
  //    For ≤80k chars (≈50 pages) → single pass (no rate-limit pauses needed).
  //    For >80k chars             → multi-chunk with synthesis.
  const chunks = chunkContractText(sanitized, MAX_CHUNK_CHARS);

  logger.info(
    {
      chunks:     chunks.length,
      totalChars: sanitized.length,
      contractType,
    },
    "Starting AI analysis with Gemini"
  );

  let result: AnalysisOutput;
  let totalPromptTokens     = 0;
  let totalCompletionTokens = 0;

  if (chunks.length === 1) {
    // ── Single-pass analysis (most contracts ≤50 pages) ──────────────────
    const { output, promptTokens, completionTokens } = await runSingleAnalysis({
      contractText:         chunks[0],
      contractType,
      jurisdiction:         params.jurisdiction,
      extractionConfidence,
    });

    result                = output;
    totalPromptTokens     = promptTokens;
    totalCompletionTokens = completionTokens;

  } else {
    // ── Multi-chunk analysis (large contracts >50 pages) ─────────────────
    //
    // Each chunk is analyzed independently, then a synthesis pass merges
    // all flags, deduplicates, and recalculates the final risk score.
    // We pause between chunks to stay within AI Studio rate limits.
    //
    const chunkOutputs: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      logger.info(
        { chunk: i + 1, total: chunks.length, chunkChars: chunks[i].length },
        "Analyzing chunk"
      );

      const { output, promptTokens, completionTokens } = await runSingleAnalysis({
        contractText:         chunks[i],
        contractType,
        jurisdiction:         params.jurisdiction,
        extractionConfidence,
        chunkInfo:            `Part ${i + 1} of ${chunks.length}`,
      });

      chunkOutputs.push(JSON.stringify(output));
      totalPromptTokens     += promptTokens;
      totalCompletionTokens += completionTokens;

      // Rate-limit pause between chunks (skip after the last chunk)
      if (i < chunks.length - 1) {
        logger.info(
          { chunk: i + 1, waitMs: INTER_CHUNK_DELAY_MS },
          "Rate-limit pause before next chunk"
        );
        await sleep(INTER_CHUNK_DELAY_MS);
      }
    }

    // Synthesis pass — merge all chunk results into one coherent analysis
    logger.info({ totalChunks: chunks.length }, "Synthesizing chunk results");
    const { output, promptTokens, completionTokens } = await runSynthesis({
      chunkResults: chunkOutputs,
      contractType,
      jurisdiction: params.jurisdiction,
    });

    result                 = output;
    totalPromptTokens     += promptTokens;
    totalCompletionTokens += completionTokens;
  }

  // 4. Post-process: validate, normalise, sort
  result = postProcess(result, contractType, extractionConfidence);

  // 5. Attach metadata
  result._meta = {
    model:               MODEL,
    promptTokens:        totalPromptTokens,
    completionTokens:    totalCompletionTokens,
    processingMs:        Date.now() - startMs,
    chunks:              chunks.length,
    extractionConfidence,
  };

  logger.info(
    {
      riskScore:    result.riskScore,
      riskLevel:    result.riskLevel,
      flags:        result.flags.length,
      missing:      result.missingClauses.length,
      chunks:       chunks.length,
      processingMs: result._meta.processingMs,
      tokens:       totalPromptTokens + totalCompletionTokens,
    },
    "Analysis complete"
  );

  return result;
}

// ─── Single chunk analysis ────────────────────────────────────────────────────

async function runSingleAnalysis(params: {
  contractText:         string;
  contractType:         string;
  jurisdiction:         string | null;
  extractionConfidence: number;
  chunkInfo?:           string;   // e.g. "Part 2 of 4" — injected into prompt
}): Promise<{ output: AnalysisOutput; promptTokens: number; completionTokens: number }> {
  const prompt  = buildAnalysisPrompt(params);
  const rawJson = await callWithRetry(prompt, true);
  const output  = parseAndValidate(rawJson);

  return { output, promptTokens: 0, completionTokens: 0 };
}

// ─── Synthesis call ───────────────────────────────────────────────────────────

async function runSynthesis(params: {
  chunkResults: string[];
  contractType: string;
  jurisdiction: string | null;
}): Promise<{ output: AnalysisOutput; promptTokens: number; completionTokens: number }> {
  const prompt  = buildSynthesisPrompt(params.chunkResults, params.contractType, params.jurisdiction);
  const rawJson = await callWithRetry(prompt, true);
  const output  = parseAndValidate(rawJson);
  return { output, promptTokens: 0, completionTokens: 0 };
}

// ─── Contract type detection ──────────────────────────────────────────────────

export async function detectContractType(text: string): Promise<string> {
  const VALID_TYPES = [
    "NDA", "SERVICE_AGREEMENT", "EMPLOYMENT",
    "SOFTWARE_LICENSE", "REAL_ESTATE", "PARTNERSHIP", "UNKNOWN",
  ];

  const prompt = buildTypeDetectionPrompt(text);

  try {
    const response = await ai.models.generateContent({
      model:    MODEL,
      contents: prompt,
      config:   { temperature: 0 },
    });

    const detected = (response.text ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z_]/g, "");

    return VALID_TYPES.includes(detected) ? detected : "UNKNOWN";
  } catch (err) {
    logger.warn({ err }, "Type detection failed — defaulting to UNKNOWN");
    return "UNKNOWN";
  }
}

// ─── Core API call with retry ─────────────────────────────────────────────────

async function callWithRetry(
  userPrompt: string,
  jsonMode:   boolean,
  attempt =   0
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model:    MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature:       TEMPERATURE,
        responseMimeType:  jsonMode ? "application/json" : "text/plain",
      },
    });

    const text = response.text;

    if (!text || text.trim().length === 0) {
      throw new AIError("Empty response from Gemini", "EMPTY_RESPONSE", false);
    }

    return text;

  } catch (err: any) {
    const status    = err?.status ?? err?.statusCode ?? 0;
    const retryable =
      status === 429 ||           // rate limited
      status === 529 ||           // overloaded
      status === 500 ||           // server error
      status === 503 ||           // service unavailable
      err?.code === "ECONNRESET" ||
      err?.code === "ETIMEDOUT";

    if (retryable && attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS[attempt] ?? 10_000;
      logger.warn(
        { status, attempt: attempt + 1, delayMs: delay },
        "Gemini API error — retrying"
      );
      await sleep(delay);
      return callWithRetry(userPrompt, jsonMode, attempt + 1);
    }

    logger.error({ err, attempt }, "Gemini API call failed");
    throw new AIError(
      `AI analysis failed after ${attempt + 1} attempt(s): ${err?.message ?? "unknown error"}`,
      retryable ? "RATE_LIMITED" : "API_ERROR",
      retryable
    );
  }
}

// ─── JSON parsing + validation ────────────────────────────────────────────────

function parseAndValidate(rawText: string): AnalysisOutput {
  // Strip markdown fences Gemini sometimes adds despite instructions
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Locate the outermost JSON object — handles any stray prose before/after
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AIError(
      "Gemini response did not contain valid JSON",
      "PARSE_ERROR",
      false
    );
  }
  cleaned = cleaned.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt light repair before giving up
    const repaired = repairJson(cleaned);
    try {
      parsed = JSON.parse(repaired);
      logger.warn("JSON was repaired before parsing");
    } catch {
      logger.error({ raw: cleaned.slice(0, 500) }, "JSON parse failed even after repair");
      throw new AIError("Failed to parse Gemini response as JSON", "PARSE_ERROR", false);
    }
  }

  // Fill in safe defaults for any missing required fields rather than throwing.
  // Partial analysis is better than a failed job.
  const required = [
    "riskScore", "riskLevel", "executiveSummary",
    "flags", "missingClauses", "negotiationPriority",
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      logger.warn({ field, keys: Object.keys(parsed) }, "Missing required field in AI response — using default");
      parsed[field] = getDefaultValue(field);
    }
  }

  return parsed as AnalysisOutput;
}

// ─── JSON repair ──────────────────────────────────────────────────────────────

function repairJson(raw: string): string {
  return raw
    // Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, "$1")
    // Fix unescaped newlines inside string values
    .replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (match, str) => (str ? str : "\\n"))
    // Replace smart/curly quotes with straight quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

// ─── Post-processing ──────────────────────────────────────────────────────────

function postProcess(
  output:               AnalysisOutput,
  contractType:         string,
  extractionConfidence: number
): AnalysisOutput {
  const VALID_TYPES = [
    "NDA", "SERVICE_AGREEMENT", "EMPLOYMENT",
    "SOFTWARE_LICENSE", "REAL_ESTATE", "PARTNERSHIP", "UNKNOWN",
  ];

  // Normalise contractType
  output.contractType = output.contractType || contractType;
  if (!VALID_TYPES.includes(output.contractType)) {
    output.contractType = VALID_TYPES.includes(contractType) ? contractType : "UNKNOWN";
  }

  // Clamp riskScore to one decimal place in range 0–10
  output.riskScore = Math.max(0, Math.min(10, Math.round((output.riskScore ?? 5) * 10) / 10));

  // Derive riskLevel from score (overrides whatever the model said — prevents hallucination)
  output.riskLevel = scoreToLevel(output.riskScore);

  // Sort flags CRITICAL → HIGH → MEDIUM → LOW
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  if (Array.isArray(output.flags)) {
    output.flags.sort(
      (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
    );
    // Ensure every flag has a stable ID
    output.flags = output.flags.map((f, i) => ({
      ...f,
      id: f.id || `flag-${i + 1}`,
    }));
  } else {
    output.flags = [];
  }

  // Ensure all array fields exist
  output.missingClauses      = output.missingClauses      || [];
  output.positives           = output.positives           || [];
  output.negotiationPriority = output.negotiationPriority || [];
  output.jurisdictionNotes   = output.jurisdictionNotes   || [];

  // Ensure exactly 3 negotiation priorities
  while (output.negotiationPriority.length < 3) {
    const topFlag = output.flags[output.negotiationPriority.length];
    output.negotiationPriority.push(
      topFlag ? topFlag.title : "Review all CRITICAL and HIGH severity flags"
    );
  }
  output.negotiationPriority = output.negotiationPriority.slice(0, 3);

  // Prepend low-confidence warning for scanned docs
  if (extractionConfidence < 0.7) {
    output.jurisdictionNotes.unshift(
      `⚠️ Document extraction confidence: ${Math.round(extractionConfidence * 100)}%. ` +
      `This document may be scanned — verify flagged section references manually.`
    );
  }

  // Fallback executiveTakeaway if model omitted it
  if (!output.executiveTakeaway) {
    output.executiveTakeaway =
      `This contract has a ${output.riskLevel} risk level with ${output.flags.length} issues identified.`;
  }

  return output;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= 3) return "LOW";
  if (score <= 5) return "MEDIUM";
  if (score <= 7) return "HIGH";
  return "CRITICAL";
}

function getDefaultValue(field: string): unknown {
  const defaults: Record<string, unknown> = {
    riskScore:           5,
    riskLevel:           "MEDIUM",
    executiveSummary:    "Analysis incomplete — please retry.",
    executiveTakeaway:   "Unable to complete analysis — please retry.",
    flags:               [],
    missingClauses:      [],
    positives:           [],
    negotiationPriority: [],
    jurisdictionNotes:   [],
  };
  return defaults[field] ?? null;
}

/**
 * Strips prompt injection attempts from contract text.
 *
 * ⚠️  Does NOT truncate — that was the old behaviour and it silently
 * threw away pages 25+ of every large contract.
 * Size management is handled entirely by chunkContractText() in parser.ts.
 */
function sanitizeContractText(text: string): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}