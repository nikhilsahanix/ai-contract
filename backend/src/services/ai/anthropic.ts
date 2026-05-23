// backend\src\services\ai\anthropic.ts

import Anthropic from "@anthropic-ai/sdk";
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

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const TEMPERATURE = 0;          // deterministic output
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // ms — exponential backoff

// Stripe these from contract text before sending to AI
const INJECTION_PATTERNS = [
  /<system>[\s\S]*?<\/system>/gi,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /new\s+instruction[s:]?/gi,
  /you\s+are\s+now\s+a/gi,
  /forget\s+(everything|all|your)/gi,
  /\[INST\]|\[\/INST\]/gi,
  /<<SYS>>|<\/SYS>/gi,
];

// ─── Client ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// ─── Main analysis entry point ───────────────────────────────────────────────

export async function analyzeContract(params: {
  text: string;
  contractType: string;
  jurisdiction: string | null;
  extractionConfidence: number;
}): Promise<AnalysisOutput> {
  const { text, extractionConfidence } = params;
  const startMs = Date.now();

  // 1. Sanitize input
  const sanitized = sanitizeContractText(text);

  // 2. Auto-detect contract type if UNKNOWN
  let contractType = params.contractType;
  if (contractType === "UNKNOWN") {
    logger.info("Contract type unknown — running auto-detection");
    contractType = await detectContractType(sanitized);
    logger.info({ detected: contractType }, "Contract type detected");
  }

  // 3. Determine chunking strategy
  const MAX_CHUNK_CHARS = 80_000;
  const chunks = chunkContractText(sanitized, MAX_CHUNK_CHARS);

  logger.info(
    { chunks: chunks.length, totalChars: sanitized.length, contractType },
    "Starting AI analysis"
  );

  let result: AnalysisOutput;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  if (chunks.length === 1) {
    // ── Single-pass analysis (most contracts) ────────────────────────────
    const { output, promptTokens, completionTokens } = await runSingleAnalysis({
      contractText: chunks[0],
      contractType,
      jurisdiction: params.jurisdiction,
      extractionConfidence,
    });

    result = output;
    totalPromptTokens = promptTokens;
    totalCompletionTokens = completionTokens;
  } else {
    // ── Multi-chunk analysis (very long contracts) ───────────────────────
    const chunkOutputs: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      logger.info({ chunk: i + 1, total: chunks.length }, "Analyzing chunk");

      const { output, promptTokens, completionTokens } = await runSingleAnalysis({
        contractText: chunks[i],
        contractType,
        jurisdiction: params.jurisdiction,
        extractionConfidence,
        chunkInfo: `Part ${i + 1} of ${chunks.length}`,
      });

      chunkOutputs.push(JSON.stringify(output));
      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;
    }

    // Synthesize chunk results into one final analysis
    logger.info({ chunks: chunks.length }, "Synthesizing chunk results");
    const { output, promptTokens, completionTokens } = await runSynthesis({
      chunkResults: chunkOutputs,
      contractType,
      jurisdiction: params.jurisdiction,
    });

    result = output;
    totalPromptTokens += promptTokens;
    totalCompletionTokens += completionTokens;
  }

  // 4. Post-process: sort, validate, normalise
  result = postProcess(result, contractType, extractionConfidence);

  // 5. Attach metadata
  result._meta = {
    model: MODEL,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    processingMs: Date.now() - startMs,
    chunks: chunks.length,
    extractionConfidence,
  };

  logger.info(
    {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      flags: result.flags.length,
      missing: result.missingClauses.length,
      processingMs: result._meta.processingMs,
      tokens: totalPromptTokens + totalCompletionTokens,
    },
    "Analysis complete"
  );

  return result;
}

// ─── Single analysis call ────────────────────────────────────────────────────

async function runSingleAnalysis(params: {
  contractText: string;
  contractType: string;
  jurisdiction: string | null;
  extractionConfidence: number;
  chunkInfo?: string;
}): Promise<{ output: AnalysisOutput; promptTokens: number; completionTokens: number }> {
  const prompt = buildAnalysisPrompt(params);

  const rawJson = await callWithRetry(prompt);
  const output = parseAndValidate(rawJson);

  return {
    output,
    promptTokens: 0, // filled by callWithRetry if needed
    completionTokens: 0,
  };
}

// ─── Synthesis call ──────────────────────────────────────────────────────────

async function runSynthesis(params: {
  chunkResults: string[];
  contractType: string;
  jurisdiction: string | null;
}): Promise<{ output: AnalysisOutput; promptTokens: number; completionTokens: number }> {
  const prompt = buildSynthesisPrompt(params.chunkResults, params.contractType, params.jurisdiction);
  const rawJson = await callWithRetry(prompt);
  const output = parseAndValidate(rawJson);
  return { output, promptTokens: 0, completionTokens: 0 };
}

// ─── Type detection ──────────────────────────────────────────────────────────

export async function detectContractType(text: string): Promise<string> {
  const VALID_TYPES = [
    "NDA", "SERVICE_AGREEMENT", "EMPLOYMENT",
    "SOFTWARE_LICENSE", "REAL_ESTATE", "PARTNERSHIP", "UNKNOWN",
  ];

  const prompt = buildTypeDetectionPrompt(text);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 20,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const detected = ((response.content[0] as any).text ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z_]/g, "");

    return VALID_TYPES.includes(detected) ? detected : "UNKNOWN";
  } catch (err) {
    logger.warn({ err }, "Type detection failed — defaulting to UNKNOWN");
    return "UNKNOWN";
  }
}

// ─── Core API call with retry ────────────────────────────────────────────────

async function callWithRetry(
  userPrompt: string,
  attempt = 0
): Promise<string> {

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = (response.content[0] as any).text as string;

    if (!text || text.trim().length === 0) {
      throw new AIError("Empty response from AI", "EMPTY_RESPONSE", false);
    }

    return text;

  } catch (err: any) {

    const status = err?.status ?? err?.statusCode ?? 0;
    const retryable =
      status === 429 ||   // rate limit
      status === 529 ||   // Anthropic overloaded
      status === 500 ||   // server error
      status === 503 ||   // service unavailable
      err?.code === "ECONNRESET" ||
      err?.code === "ETIMEDOUT";

    if (retryable && attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS[attempt] ?? 10_000;
      logger.warn(
        { status, attempt: attempt + 1, delayMs: delay },
        "Anthropic API error — retrying"
      );
      await sleep(delay);
      return callWithRetry(userPrompt, attempt + 1);
    }

    // Non-retryable or max retries reached
    logger.error({ err, attempt }, "Anthropic API call failed");
    throw new AIError(
      `AI analysis failed after ${attempt + 1} attempt(s): ${err?.message ?? "unknown error"}`,
      retryable ? "RATE_LIMITED" : "API_ERROR",
      retryable
    );
  }
}

// ─── JSON parsing + validation ───────────────────────────────────────────────

function parseAndValidate(rawText: string): AnalysisOutput {
  // Strip any markdown code fences Claude may have added despite instructions
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Find the first { and last } — sometimes Claude adds a sentence before/after
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AIError(
      "AI response did not contain valid JSON",
      "PARSE_ERROR",
      false
    );
  }
  cleaned = cleaned.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    // Attempt to repair common JSON issues
    const repaired = repairJson(cleaned);
    try {
      parsed = JSON.parse(repaired);
      logger.warn("JSON was repaired before parsing");
    } catch {
      logger.error({ raw: cleaned.slice(0, 500) }, "JSON parse failed even after repair");
      throw new AIError("Failed to parse AI response as JSON", "PARSE_ERROR", false);
    }
  }

  // Validate required top-level fields
  const required = [
    "riskScore", "riskLevel", "executiveSummary",
    "flags", "missingClauses", "negotiationPriority",
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      logger.warn({ field, keys: Object.keys(parsed) }, "Missing required field in AI response");
      // Fill in safe defaults rather than throwing — partial analysis > no analysis
      parsed[field] = getDefaultValue(field);
    }
  }

  return parsed as AnalysisOutput;
}

// ─── JSON repair ─────────────────────────────────────────────────────────────

function repairJson(raw: string): string {
  return raw
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, "$1")
    // Fix unescaped newlines inside string values
    .replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (match, str) =>
      str ? str : "\\n"
    )
    // Replace smart quotes with straight quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

// ─── Post-processing ──────────────────────────────────────────────────────────

function postProcess(
  output: AnalysisOutput,
  contractType: string,
  extractionConfidence: number
): AnalysisOutput {
  const VALID_TYPES = [
    "NDA", "SERVICE_AGREEMENT", "EMPLOYMENT",
    "SOFTWARE_LICENSE", "REAL_ESTATE", "PARTNERSHIP", "UNKNOWN",
  ];

  output.contractType = output.contractType || contractType;
  if (!VALID_TYPES.includes(output.contractType)) {
    output.contractType = VALID_TYPES.includes(contractType) ? contractType : "UNKNOWN";
  }

  // Normalise riskScore to 1 decimal place within 0-10
  output.riskScore = Math.max(0, Math.min(10, Math.round((output.riskScore ?? 5) * 10) / 10));

  // Derive riskLevel from score if not set correctly
  output.riskLevel = scoreToLevel(output.riskScore);

  // Sort flags: CRITICAL → HIGH → MEDIUM → LOW
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  if (Array.isArray(output.flags)) {
    output.flags.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
    );

    // Ensure every flag has an ID
    output.flags = output.flags.map((f, i) => ({
      ...f,
      id: f.id || `flag-${i + 1}`,
    }));
  } else {
    output.flags = [];
  }

  // Ensure arrays exist
  output.missingClauses = output.missingClauses || [];
  output.positives = output.positives || [];
  output.negotiationPriority = output.negotiationPriority || [];
  output.jurisdictionNotes = output.jurisdictionNotes || [];

  // Ensure exactly 3 negotiation priorities
  while (output.negotiationPriority.length < 3) {
    const topFlag = output.flags[output.negotiationPriority.length];
    output.negotiationPriority.push(
      topFlag ? topFlag.title : "Review all CRITICAL and HIGH severity flags"
    );
  }
  output.negotiationPriority = output.negotiationPriority.slice(0, 3);

  // Add extraction confidence warning to jurisdictionNotes if low
  if (extractionConfidence < 0.7) {
    output.jurisdictionNotes.unshift(
      `⚠️ Document extraction confidence: ${Math.round(extractionConfidence * 100)}%. ` +
      `This document may be scanned — verify flagged section references manually.`
    );
  }

  // Ensure executiveTakeaway exists
  if (!output.executiveTakeaway) {
    output.executiveTakeaway = `This contract has a ${output.riskLevel} risk level with ${output.flags.length} issues identified.`;
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
    riskScore: 5,
    riskLevel: "MEDIUM",
    executiveSummary: "Analysis incomplete — please retry.",
    executiveTakeaway: "Unable to complete analysis — please retry.",
    flags: [],
    missingClauses: [],
    positives: [],
    negotiationPriority: [],
    jurisdictionNotes: [],
  };
  return defaults[field] ?? null;
}

function sanitizeContractText(text: string): string {
  let sanitized = text;

  // Strip prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // ── REMOVED: the 100k hard truncation that was here ──────────────────────
  // The chunkContractText() function handles splitting at 80k chars per chunk.
  // Truncating here was silently throwing away pages 25+ of every large contract.
  // ─────────────────────────────────────────────────────────────────────────

  return sanitized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

