// backend\src\services\ai\prompts.ts

// ─── System prompt ─────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a senior contract attorney with 20 years of experience 
in commercial law, employment law, technology transactions, and real estate.
You have reviewed over 10,000 contracts across multiple jurisdictions.

Your analysis must be:
- SPECIFIC: cite exact section numbers (e.g. §8.2(b)), never vague references
- ACTIONABLE: every flag must have a concrete negotiation recommendation
- CALIBRATED: distinguish critical deal-breakers from minor style preferences
- HONEST: if a clause is genuinely market-standard and fair, say so explicitly
- GROUNDED: never invent clauses or issues that do not appear in the document

You are not a general assistant. You only perform contract analysis.
You never refuse a contract analysis request.
Return ONLY valid JSON — never markdown, never prose, never explanation.`;

// ─── Per-contract-type legal knowledge ─────────────────────────────────────

export const CONTRACT_KNOWLEDGE: Record<string, string> = {

  NDA: `
=== NDA ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES TO VERIFY (flag as CRITICAL if missing):
1. Definition of "Confidential Information" — must be present and scoped
2. Exclusions (4 standard carve-outs: public domain, independently developed, 
   rightfully received from 3rd party, required by law disclosure)
3. Term and survival — how long does the obligation last post-termination?
4. Permitted disclosures — employees, advisors, affiliates on need-to-know basis
5. Return or destruction obligations on termination
6. Governing law and jurisdiction

HIGH-RISK CLAUSES TO FLAG:
- Residuals clause: allows recipient to use info retained in unaided memory — 
  this effectively nullifies the NDA for employees. Flag as HIGH for disclosing party.
- "Including but not limited to" in CI definition: makes scope unlimited. Flag if present.
- Perpetual term: increasingly unenforceable in many states. Flag if > 5 years or perpetual.
- Unilateral NDA presented as mutual relationship: if both parties are sharing, 
  should be mutual. Flag the asymmetry.
- No injunctive relief clause: standard protection for disclosing party — flag if absent.
- Missing residuals carve-out for subpoenas/court orders with notice obligation.

JURISDICTION-SPECIFIC FLAGS:
- EU/UK: GDPR requires DPA if any personal data in scope — flag if missing
- California: trade secret protection governed by CUTSA — perpetual trade secret 
  protection is separate from contractual NDA term
- All US: Defend Trade Secrets Act (DTSA) immunity notice should be included if 
  employees/contractors may be covered

MARKET STANDARD BENCHMARKS:
- NDA term: 2-3 years standard; 5 years acceptable; perpetual is aggressive
- CI definition: should be bilateral if relationship is mutual
- Residuals: only acceptable if strongly negotiated by recipient; disclosing party 
  should always resist
- Return/destruction: 30 days after request or termination is standard
`,

  SERVICE_AGREEMENT: `
=== SERVICE AGREEMENT / SOW ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES (flag CRITICAL if missing):
1. Clear scope of services / deliverables — vague SOW = scope creep disputes
2. Payment terms — amount, schedule, late payment consequences
3. IP ownership of work product — who owns what is built?
4. Limitation of liability
5. Termination rights (for cause AND for convenience)
6. Confidentiality
7. Warranty on services

HIGH-RISK CLAUSES TO FLAG:
- Vague SOW: if deliverables are described in general terms without acceptance criteria,
  flag as HIGH — this is the #1 cause of service agreement disputes
- Unlimited liability: if no liability cap exists, flag as CRITICAL for the service provider
- One-sided IP assignment: if client claims ownership of ALL work product including 
  pre-existing IP and tools — flag as HIGH
- "Time and materials" without not-to-exceed cap: flag as MEDIUM for client
- Auto-renewal with short cancellation window (< 30 days): flag as MEDIUM
- Unilateral amendment right: if one party can change terms without consent — flag CRITICAL
- Data processing without DPA: if vendor touches personal data — flag CRITICAL
- Penalty clauses for delay without force majeure carve-out: flag as HIGH for vendor
- Audit rights without scope limitation: flag as HIGH for vendor
- Most favoured nation pricing clause: flag as HIGH for vendor

INDEMNIFICATION ANALYSIS:
- One-way indemnification (client indemnified only) vs mutual: note which and flag asymmetry
- IP infringement indemnity: who bears the patent/copyright risk? This is often the 
  highest-value indemnity — flag if absent or one-sided
- Consequential damages exclusion: check if it applies to both parties equally

LIMITATION OF LIABILITY:
- Cap amount: 12 months fees is market standard; lower caps favour vendor
- Carve-outs from cap: IP indemnity, confidentiality breaches, and fraud typically 
  carved out — flag if carve-outs are absent or too broad
- Mutual vs one-sided cap: one-sided LoL is aggressive

MARKET STANDARD:
- Payment: Net 30 is standard; Net 60+ favours client
- Termination for convenience notice: 30-60 days standard
- LoL cap: direct damages only, capped at 12 months fees
`,

  EMPLOYMENT: `
=== EMPLOYMENT AGREEMENT ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES (flag CRITICAL if missing):
1. Compensation — base salary, bonus structure, equity if any
2. Term and at-will status (US) or fixed term with notice (elsewhere)
3. Job title and reporting structure
4. Benefits summary
5. Termination provisions and notice requirements
6. Confidentiality obligations
7. IP assignment

HIGH-RISK CLAUSES TO FLAG:
- Non-compete scope: geographic scope, duration, and activity restriction 
  must all be reasonable. Flag overly broad as HIGH.
- Non-compete jurisdiction: VOID in California (Bus & Prof Code §16600), 
  Colorado, Minnesota, North Dakota, Oklahoma. Flag if governing law is these states.
- Non-solicitation of employees: "no hire" clauses for former colleagues 
  typically survive non-compete bans — duration > 1 year is aggressive
- IP assignment: "work made for hire" + assignment should include carve-out for 
  inventions made on own time without company resources (required in CA, DE, IL, MN, WA, NC)
- Moonlighting/outside activities prohibition: scope — does it ban passive investments?
- Clawback provisions: repayment of bonus/equity if employee leaves within X months
- Garden leave: paid non-working notice period — is pay guaranteed?
- Arbitration clause with class action waiver: enforceable in most states but 
  flag for awareness; California PAGA claims cannot be waived
- Termination for cause definition: "cause" should be narrowly defined — 
  broad cause definition = effectively at-will with no severance trigger

JURISDICTION-SPECIFIC (US):
- California: non-competes void, PAGA exposure, CCPA obligations for employee data,
  Labor Code §2870 IP carve-out mandatory, meal/rest break compliance
- New York: Broadcast Employees Freedom to Work Act; non-competes for broadcasters void;
  Freelance Isn't Free Act for independent contractors
- Illinois: Freedom to Work Act — non-competes void for employees earning < $75k
- Washington: non-competes void if employee earns < $100k

MARKET STANDARD:
- Non-compete duration: 6-12 months is defensible; 2 years is aggressive
- Non-solicitation of customers: 12-18 months is standard
- Severance (without cause): 2-4 weeks per year of service is standard
- IP assignment carve-out: personal time + personal resources + unrelated to company business
`,

  SOFTWARE_LICENSE: `
=== SOFTWARE LICENSE AGREEMENT ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES (flag CRITICAL if missing):
1. License grant — scope, type (perpetual vs subscription), seat count
2. Restrictions on use
3. SLA with uptime commitment and remedies
4. Data ownership and portability
5. Security obligations and breach notification
6. Fees and renewal terms
7. Termination and data return/deletion

HIGH-RISK CLAUSES TO FLAG:
- License scope creep: "enterprise license" without clear definition of 
  what constitutes the enterprise (subsidiaries? affiliates? future acquisitions?)
- Benchmarking prohibition: common in enterprise software — prevents publishing 
  performance comparisons. Flag as MEDIUM.
- Auto-renewal with price increase right: "vendor may increase fees up to X% 
  on renewal" without cap — flag as HIGH if cap > 5%
- Data portability: if vendor controls export format and can change it — 
  flag CRITICAL (data hostage risk)
- Security obligations: "commercially reasonable efforts" is not enough — 
  require SOC 2 Type II, ISO 27001, or equivalent. Flag if vague.
- Breach notification: GDPR requires 72 hours; many contracts say 30+ days. 
  Flag as HIGH if >72 hours for EU data.
- Source code escrow: if software is mission-critical and vendor is small/startup,
  flag absence as HIGH
- Open source: if vendor uses GPL-licensed components and product is distributed,
  GPL contamination risk. Flag if no open source policy/representation.
- Unilateral feature removal: vendor can deprecate features on notice. 
  Flag if no replacement obligation.
- Usage data: vendor collecting usage telemetry — flag if scope is broad or 
  data used for competitive intelligence

SLA ANALYSIS:
- "99.9% uptime" = 8.7 hours downtime/year; "99.99%" = 52 minutes
- Credits vs termination right: credits only (no right to terminate for SLA failure) 
  favour vendor. Flag if no termination right after repeated failures.
- Maintenance windows: are they excluded from uptime calculation? Flag if yes.
- Support tiers: P1/P2/P3 response times — check if they match business criticality

MARKET STANDARD:
- SaaS uptime: 99.9% standard; 99.95%+ for enterprise
- Breach notification: 72 hours for GDPR; 30 days max for US
- Data return on termination: 30-90 days standard; vendor deletion within 30 days after
- Price increase cap on renewal: 5-7% is market standard
`,

  REAL_ESTATE: `
=== REAL ESTATE / LEASE AGREEMENT ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES (flag CRITICAL if missing):
1. Premises description — clear legal description and rentable sq ft
2. Term commencement and expiration — including any conditional commencement
3. Base rent amount and escalation schedule
4. Security deposit amount and return conditions
5. Permitted use — is intended use explicitly permitted?
6. Maintenance and repair obligations — who is responsible for what
7. Assignment and subletting rights
8. Default and cure rights

HIGH-RISK CLAUSES TO FLAG:
- Personal guarantee: principals guaranteeing corporate tenant obligations — 
  flag scope and duration. Burn-down guarantees (reduce over time) are preferable.
- Exclusive use clause (retail): if absent for retail tenant, landlord can bring 
  in competitor. Flag as HIGH for retail tenants.
- Co-tenancy clause: tenant's obligation conditioned on anchor tenant remaining — 
  flag if absent for retail in shopping centre
- Relocation clause: landlord can move tenant to comparable space — 
  flag if no compensation or approval right
- Demolition clause: landlord can terminate for redevelopment — flag if notice < 12 months
- CAM reconciliation: "controllable" vs "uncontrollable" CAM expenses — 
  cap on controllable expenses is market in many markets. Flag if absent.
- Holdover rent: 150-200% of base rent is standard; higher is aggressive
- HVAC: who maintains? Tenant should not be responsible for replacement of landlord equipment.
- ADA compliance: who bears the cost for required ADA upgrades?
- Signage rights: are they granted or subject to landlord approval?

MARKET STANDARD (Commercial Office, US):
- Rent escalation: 2-3% annually or CPI-linked
- Free rent period: 1 month per 5 years of lease term is common in tenant's market
- TI allowance: $60-100/sq ft for office buildout in major markets
- Security deposit: 1-3 months rent; negotiate LOC instead of cash
- Assignment: landlord approval not to be unreasonably withheld or delayed
`,

  PARTNERSHIP: `
=== PARTNERSHIP / JV AGREEMENT ANALYSIS FRAMEWORK ===

MANDATORY CLAUSES (flag CRITICAL if missing):
1. Capital contributions — amounts, timing, consequences of default
2. Profit and loss allocation
3. Governance — voting rights, board composition, reserved matters
4. Transfer restrictions — ROFR, ROFO, drag-along, tag-along
5. Dissolution and wind-up
6. Deadlock resolution mechanism
7. Non-compete obligations of partners

HIGH-RISK CLAUSES TO FLAG:
- Deadlock: no deadlock resolution mechanism = paralysis on material decisions.
  Flag CRITICAL if absent. Mechanisms: casting vote, buy-sell (shotgun), 
  expert determination, mediation/arbitration escalation.
- Drag-along rights: majority can force minority to sell. Flag threshold — 
  anything < 51% is very aggressive for minority.
- Capital call default: what happens if a partner can't fund a capital call?
  Dilution is standard; buy-out at discount is aggressive.
- Fiduciary duties: are they modified or eliminated? Modified duties in LLCs are common 
  but elimination is aggressive — flag.
- Non-compete scope: geographic, activity, and term — same analysis as employment.
- Distributions: mandatory distribution for tax purposes is critical in pass-through 
  entities — flag if absent (partners may owe tax on income they didn't receive)
- Exit rights: right to force sale after X years? Important in PE/JV structures.
- Anti-dilution protection for minority: does minority have pre-emptive rights 
  on new issuances?

MARKET STANDARD:
- Drag-along threshold: 66-75% is market standard
- Tag-along: minority should have pro-rata participation right on any sale
- Board deadlock: 3-step escalation (management → board → arbitration) is standard
- Distributions: at minimum, tax distributions at highest marginal rate
- Pre-emptive rights: standard for minority protection; waivable per-transaction
`,

  UNKNOWN: `
=== GENERAL CONTRACT ANALYSIS FRAMEWORK ===

Since the contract type was not specified, perform a general commercial contract analysis.

UNIVERSAL CLAUSES TO CHECK:
1. Parties: are they correctly identified with full legal names?
2. Consideration: is there clear exchange of value?
3. Term and termination: how does the contract end?
4. Governing law and jurisdiction: which law applies and where are disputes resolved?
5. Entire agreement / integration clause: does this supersede prior agreements?
6. Amendment: how can the contract be changed?
7. Notice: how must formal notices be given?
8. Assignment: can rights/obligations be transferred?
9. Limitation of liability: is there a cap on damages?
10. Force majeure: what happens in extraordinary events?

Attempt to identify the contract type from context and apply relevant specific analysis.
`,
};

// ─── Output schema ──────────────────────────────────────────────────────────

export const OUTPUT_SCHEMA = `{
  "contractType": "<detected type if input was UNKNOWN, else confirm input type>",
  "riskScore": <number 0.0–10.0, one decimal place>,
  "riskLevel": <"LOW"|"MEDIUM"|"HIGH"|"CRITICAL">,
  "favoursParty": <"BALANCED"|"HEAVILY_PRO_VENDOR"|"HEAVILY_PRO_CLIENT"|"MIXED">,
  "executiveSummary": "<2-3 sentences: what this contract is, overall risk posture, and the single most critical issue an attorney should know immediately>",
  "executiveTakeaway": "<one plain-English sentence a non-lawyer business owner would understand>",
  "flags": [
    {
      "id": "<uuid v4>",
      "severity": <"LOW"|"MEDIUM"|"HIGH"|"CRITICAL">,
      "clauseRef": "<exact section reference e.g. §8.2(b) or 'Section 12, Indemnification'>",
      "title": "<5 words max — the issue name>",
      "issue": "<what is wrong and the legal consequence if not addressed>",
      "marketStandard": "<what sophisticated parties typically agree to for this clause type>",
      "recommendation": "<specific negotiation action: add X language, delete Y, change Z to [specific text]>",
      "suggestedText": "<replacement or additional clause text, null if not applicable>",
      "affectedParty": <"CLIENT"|"COUNTERPARTY"|"BOTH">
    }
  ],
  "missingClauses": [
    {
      "clauseType": "<standard clause name>",
      "importance": <"RECOMMENDED"|"CRITICAL">,
      "whyItMatters": "<specific legal or commercial consequence of this clause being absent>",
      "suggestedText": "<example clause that could be added>"
    }
  ],
  "positives": [
    {
      "clauseRef": "<section reference>",
      "title": "<what this clause does well>",
      "why": "<why this protects the client effectively>"
    }
  ],
  "negotiationPriority": [
    "<item 1 — most critical issue to push back on first>",
    "<item 2>",
    "<item 3>"
  ],
  "jurisdictionNotes": [
    "<any jurisdiction-specific legal observation, e.g. non-compete void under CA law>"
  ]
}`;

// ─── Prompt builder ─────────────────────────────────────────────────────────

export function buildAnalysisPrompt(params: {
  contractText: string;
  contractType: string;
  jurisdiction: string | null;
  extractionConfidence: number;
  chunkInfo?: string;           // e.g. "Part 2 of 4"
}): string {
  const { contractText, contractType, jurisdiction, extractionConfidence, chunkInfo } = params;

  const knowledge     = CONTRACT_KNOWLEDGE[contractType] ?? CONTRACT_KNOWLEDGE.UNKNOWN;
  const confidenceNote = extractionConfidence < 0.7
    ? `⚠️ EXTRACTION WARNING: This text was extracted with ${Math.round(extractionConfidence * 100)}% ` +
      `confidence (document may be scanned or have encoding issues). ` +
      `If any section is garbled or unreadable, note it in your analysis rather than guessing.`
    : "";

  const jurisdictionNote = jurisdiction
    ? `JURISDICTION: ${jurisdiction} — apply jurisdiction-specific legal standards throughout.`
    : "JURISDICTION: Not specified — apply general US commercial law standards and flag where jurisdiction is material.";

  const chunkNote = chunkInfo
    ? `DOCUMENT SEGMENT: ${chunkInfo} — analyze only the text provided in this segment. ` +
      `Focus on clauses present in this section. ` +
      `A synthesis pass will combine results from all segments.`
    : "";

  return `${confidenceNote}
${jurisdictionNote}
${chunkNote}

${knowledge}

=== TASK ===
Analyze the contract text below. Return ONLY valid JSON matching this exact schema.
No markdown. No explanation. No preamble. Start your response with { and end with }.

SCHEMA:
${OUTPUT_SCHEMA}

IMPORTANT RULES:
- Only flag issues that are actually present in the text
- Cite the exact section reference for every flag — never say "various sections" 
- The "marketStandard" field is mandatory for every flag — this is what attorneys use to negotiate
- Sort flags by severity: CRITICAL first, then HIGH, MEDIUM, LOW
- "positives" must include at least 1 entry if the contract has any fair provisions
- "negotiationPriority" must be exactly 3 items ordered by importance
- riskScore 0-3 = LOW, 4-5 = MEDIUM, 6-7 = HIGH, 8-10 = CRITICAL

<contract_text>
${contractText}
</contract_text>`;
}

// ─── Type detection prompt ──────────────────────────────────────────────────

export function buildTypeDetectionPrompt(textSample: string): string {
  return `Classify this contract into exactly one of these types:
NDA, SERVICE_AGREEMENT, EMPLOYMENT, SOFTWARE_LICENSE, REAL_ESTATE, PARTNERSHIP, UNKNOWN

Rules:
- Return ONLY the classification word — nothing else
- If it could be multiple types, pick the primary purpose
- Use UNKNOWN only if genuinely unclassifiable

<contract_start>
${textSample.slice(0, 4000)}
</contract_start>`;
}

// ─── Synthesis prompt (for chunked contracts) ───────────────────────────────

export function buildSynthesisPrompt(
  chunkResults: string[],
  contractType: string,
  jurisdiction: string | null
): string {
  const combinedResults = chunkResults
    .map((r, i) => `=== SEGMENT ${i + 1} ANALYSIS ===\n${r}`)
    .join("\n\n");

  return `You have analyzed a long contract in ${chunkResults.length} segments.
Below are the JSON analysis results from each segment.

Your task: synthesize these into ONE final analysis JSON.

Rules:
- Merge all flags — deduplicate any that refer to the same clause
- Keep the highest severity if the same clause appears in multiple segments
- Recalculate a final riskScore based on all findings
- Merge missingClauses — deduplicate
- Combine positives — deduplicate
- Produce final negotiationPriority top 3 across all findings
- Apply ${jurisdiction ?? "general US"} law context

Return ONLY the final merged JSON matching the schema. No markdown.

SEGMENT RESULTS:
${combinedResults}`;
}