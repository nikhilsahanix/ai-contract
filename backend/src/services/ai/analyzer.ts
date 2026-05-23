import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { 
  buildAnalysisPrompt, 
  buildTypeDetectionPrompt, 
  buildSynthesisPrompt, 
  SYSTEM_PROMPT 
} from "./prompts.js";
import { chunkContractText, ExtractionResult } from "../pdf/parser.js";

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// The model we use for high-fidelity text analysis
const MODEL = "claude-3-5-sonnet-20240620"; 

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface AnalysisResult {
  contractType: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  favoursParty: "BALANCED" | "HEAVILY_PRO_VENDOR" | "HEAVILY_PRO_CLIENT" | "MIXED";
  executiveSummary: string;
  executiveTakeaway: string;
  flags: any[];
  missingClauses: any[];
  positives: any[];
  negotiationPriority: string[];
  jurisdictionNotes: string[];
}

// ─── Main Execution ────────────────────────────────────────────────────────

/**
 * Analyzes the extracted contract text using Claude.
 * Handles auto-classification, chunking for long documents, and JSON parsing with retries.
 */
export async function analyzeContract(
  extraction: ExtractionResult,
  declaredType: string = "UNKNOWN",
  jurisdiction: string | null = null
): Promise<AnalysisResult> {
  logger.info({ charCount: extraction.charCount, declaredType }, "Starting AI analysis");

  let actualType = declaredType;

  // 1. Auto-detect type if UNKNOWN
  if (actualType === "UNKNOWN") {
    actualType = await detectContractType(extraction.text);
    logger.info({ detectedType: actualType }, "Auto-classified contract type");
  }

  // 2. Chunking strategy
  // Claude has a 200k context window, but performance drops on massive docs.
  // We chunk at 80k chars (~20k tokens) to ensure high-fidelity clause detection.
  const chunks = chunkContractText(extraction.text, 80000);
  
  if (chunks.length === 1) {
    // Standard execution: Single pass
    return executeAnalysisCall(extraction, actualType, jurisdiction, chunks[0]);
  } else {
    // Multi-pass execution: Analyze chunks in parallel, then synthesize
    logger.info({ chunkCount: chunks.length }, "Executing multi-pass analysis");
    return executeMultiPassAnalysis(extraction, actualType, jurisdiction, chunks);
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────

async function executeAnalysisCall(
  extraction: ExtractionResult,
  type: string,
  jurisdiction: string | null,
  textChunk: string,
  chunkInfo?: string
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt({
    contractText: textChunk,
    contractType: type,
    jurisdiction,
    extractionConfidence: extraction.confidence,
    chunkInfo
  });

  return callClaudeWithRetry(prompt);
}

async function executeMultiPassAnalysis(
  extraction: ExtractionResult,
  type: string,
  jurisdiction: string | null,
  chunks: string[]
): Promise<AnalysisResult> {
  // 1. Analyze chunks concurrently
  const chunkPromises = chunks.map((chunkText, index) => {
    return executeAnalysisCall(
      extraction, 
      type, 
      jurisdiction, 
      chunkText, 
      `Part ${index + 1} of ${chunks.length}`
    );
  });

  const chunkResults = await Promise.all(chunkPromises);

  // 2. Synthesize the JSON strings into one final output
  logger.info("Synthesizing chunked results");
  const rawJsonStrings = chunkResults.map(res => JSON.stringify(res));
  const synthesisPrompt = buildSynthesisPrompt(rawJsonStrings, type, jurisdiction);
  
  return callClaudeWithRetry(synthesisPrompt);
}

async function detectContractType(text: string): Promise<string> {
  try {
    const prompt = buildTypeDetectionPrompt(text);
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 20,
      temperature: 0.0,
      system: "You are a precise classifier. Return only the requested category name.",
      messages: [{ role: "user", content: prompt }]
    });

    const type = (response.content[0] as any).text.trim().toUpperCase();
    const validTypes = ["NDA", "SERVICE_AGREEMENT", "EMPLOYMENT", "SOFTWARE_LICENSE", "REAL_ESTATE", "PARTNERSHIP"];
    
    return validTypes.includes(type) ? type : "UNKNOWN";
  } catch (error) {
    logger.warn({ error }, "Type detection failed, defaulting to UNKNOWN");
    return "UNKNOWN";
  }
}

/**
 * Calls Claude and enforces strict JSON parsing. 
 * If Claude accidentally includes conversational text (e.g., "Here is the JSON: { ... }"),
 * this attempts to extract just the JSON. If parsing fails entirely, it retries once.
 */
/**
 * Calls Claude and enforces strict JSON parsing. 
 * Attempts to extract just the JSON if Claude adds conversational text.
 */
async function callClaudeWithRetry(prompt: string, retries = 1): Promise<AnalysisResult> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000, 
      temperature: 0.0, 
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    });

    let responseText = (response.content[0] as any).text;

    // Safety strip: Remove markdown formatting safely without breaking IDE syntax highlighting
    responseText = responseText.replace(new RegExp("^```(?:json)?\\s*", "m"), "");
    responseText = responseText.replace(new RegExp("```\\s*$", "m"), "");
    
    // Safety strip: Extract just the object
    const jsonStart = responseText.indexOf("{");
    const jsonEnd = responseText.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      responseText = responseText.substring(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(responseText) as AnalysisResult;
    
  } catch (error: any) {
    if (retries > 0) {
      logger.warn({ error: error.message }, "JSON parse failed, retrying analysis");
      return callClaudeWithRetry(prompt, retries - 1);
    }
    
    logger.error({ error }, "Critical failure: AI returned unparseable response");
    throw new Error("AI analysis failed to produce valid structured output.");
  }
}