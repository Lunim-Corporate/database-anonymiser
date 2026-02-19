import { llmComplete  } from "./ai.llm";
import { logger } from "../utils/logger";
import YAML from "yaml";


export type AiRecommendationResult = {
  yaml: string;
  source: "llm" | "heuristic";
  llmFailed?: boolean;
  message?: string;
};

export type AiExplainInput = {
  config: any;
  plan: any;
};


// function parseYamlSafely(text: string): any {
//   return YAML.parse(text);
// }

function extractGlobalColumnsFromRules(rules: any[]): string[] {
  const set = new Set<string>();

  for (const rule of rules) {
    for (const col of rule.columns ?? []) {
      set.add(col.column);
    }
  }

  return Array.from(set).sort();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function recommendColumnStrategyYAML(input: {
  config: any;
  samples?: any;
  tablesList?: string[];
}): Promise<AiRecommendationResult> {

  const allColumns = extractGlobalColumnsFromRules(input.config.rules);
  const batches = chunkArray(allColumns, 50);
  const globalMap: Record<string, string> = {};

  let llmFailed = false;

  for (const batch of batches) {

    //const prompt = `... same prompt ...`;
    const prompt = `
You are a senior data privacy engineer.

Classify each column below into EXACTLY ONE of these strategies:

KEEP
EMAIL_FAKE
HASH_SHA256
REDACT
SET_NULL

STRICT RULES:
- Output ONE column per line
- Format must be: column_name: STRATEGY
- Do NOT add explanations
- Do NOT skip columns
- Do NOT invent columns
- Use ONLY the allowed strategies
- If unsure, default to KEEP

Example:
email: EMAIL_FAKE
user_id: HASH_SHA256
created_at: KEEP

Columns:
${batch.join("\n")}
`;


    let llmOutput: string | null = null;

    try {
      llmOutput = await llmComplete(prompt);
    } catch {
      llmOutput = null;
    }

    if (!llmOutput) {
      logger.warn("LLM batch failed — using deterministic fallback");
      llmFailed = true;

      for (const col of batch) {
        globalMap[col] = deterministicStrategy(col);
      }
      continue;
    }

    try {
      const lines = llmOutput.split("\n");

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;

        const parts = cleaned.split(":");
        if (parts.length !== 2) continue;

        const column = parts[0].trim();
        const strategy = parts[1].trim();

        if (
          batch.includes(column) &&
          ALLOWED_STRATEGIES.includes(strategy as any)
        ) {
          globalMap[column] = strategy;
        }
      }

      for (const col of batch) {
        if (!globalMap[col]) {
          globalMap[col] = deterministicStrategy(col);
        }
      }

    } catch {
      logger.warn("LLM parsing failed — using deterministic fallback");
      llmFailed = true;

      for (const col of batch) {
        globalMap[col] = deterministicStrategy(col);
      }
    }
  }

  applyDeterministicOverlay(globalMap);

  return {
    yaml: buildFinalYaml(globalMap),
    source: llmFailed ? "heuristic" : "llm",
    llmFailed,
    message: llmFailed
      ? "⚠️ LLM recommendation failed. Deterministic heuristic policy has been applied instead."
      : "✅ AI recommendation successfully generated."
  };
}


function applyDeterministicOverlay(globalMap: Record<string, string>) {
  for (const column of Object.keys(globalMap)) {
    const forced = deterministicStrategy(column);

    // If deterministic policy says something stricter than KEEP, override
    if (forced !== "KEEP") {
      globalMap[column] = forced;
    }
  }
}




function deterministicStrategy(column: string): string {
  const lc = column.toLowerCase();

  // STRONG SENSITIVE — ALWAYS SET_NULL
  if (
    /(password|secret|token|api[_]?key|access[_]?key|auth|private|encrypted)/.test(lc)
  ) {
    return "SET_NULL";
  }

  // EMAILS
  if (lc.includes("email")) {
    return "EMAIL_FAKE";
  }

  // IDENTIFIERS — HASH
  if (
    /(phone|mobile|username|user[_]?id|uid|msisdn|skype)/.test(lc)
  ) {
    return "HASH_SHA256";
  }

  // FREE TEXT / PII STRINGS — REDACT
  if (
    /(name|address|notes|description|message|body|content|headline|postcode)/.test(lc)
  ) {
    return "REDACT";
  }

  // SAFE SYSTEM FIELDS — KEEP
  if (
    /^(id|created_at|updated_at|status|type)$/.test(lc)
  ) {
    return "KEEP";
  }

  // Default safe baseline
  return "KEEP";
}


function buildFinalYaml(globalMap: Record<string, string>): string {
  const grouped: Record<string, string[]> = {
    KEEP: [],
    EMAIL_FAKE: [],
    HASH_SHA256: [],
    REDACT: [],
    SET_NULL: [],
  };

  for (const [col, strategy] of Object.entries(globalMap)) {
    if (!grouped[strategy]) {
      grouped.KEEP.push(col);
    } else {
      grouped[strategy].push(col);
    }
  }

  const lines: string[] = [];
  lines.push("column_strategy:");

  for (const strategy of ALLOWED_STRATEGIES) {
    lines.push(`  ${strategy}:`);
    for (const col of grouped[strategy].sort()) {
      lines.push(`    - ${col}`);
    }
  }

  return lines.join("\n");
}

const ALLOWED_STRATEGIES = [
  "KEEP",
  "EMAIL_FAKE",
  "HASH_SHA256",
  "REDACT",
  "SET_NULL",
] as const;



// function fallbackRecommendationYamlFromRules(rules: any[]): string {
//   const allColumns = extractGlobalColumnsFromRules(rules);

//   const globalMap: Record<string, string> = {};

//   for (const col of allColumns) {
//     globalMap[col] = deterministicStrategy(col);
//   }

//   return buildFinalYaml(globalMap);
// }


export async function explainSafety(
  input: AiExplainInput
): Promise<string> {
  const { config, plan } = input;

  const planSummary = plan.tables.map((t: any) => ({
    table: t.table,
    columns: t.columns.map((c: any) => ({
      column: c.column,
      strategy: c.strategy,
    })),
  }));

  const denylisted = config.scope?.denylistTables || [];

  const prompt = `
You are generating a client-facing data safety explanation.

Audience:
- Non-technical stakeholders
- Security reviewers, Developers and Testers

Rules:
- Explain WHAT data existed and HOW it was transformed and WHY it was transformed. 
- Reference strategies actually applied.
- Group explanations (emails, identifiers, free-text, tokens)
- Avoid repeating column names excessively.
- Include Summary and mention denylisted tables.
- Do NOT invent claims or hallucinate details. 
- keep it concise, clear, and to the point.

Anonymization plan:
${JSON.stringify(planSummary, null, 2)}

Denylisted tables:
${JSON.stringify(denylisted, null, 2)}

Return markdown only.
`;

  try {
    const llmOutput = await llmComplete(prompt);

    if (!llmOutput) {
      logger.warn("LLM unavailable — returning fallback explanation - inside explainSafety");
      return fallbackExplanation(plan, denylisted);
    }

    return llmOutput.trim();
  } catch {
    return fallbackExplanation(plan, denylisted);
  }
}


function fallbackExplanation(plan: any, denylisted: string[]): string {
  const strategyCount: Record<string, number> = {};

  for (const t of plan.tables) {
    for (const c of t.columns) {
      strategyCount[c.strategy] = (strategyCount[c.strategy] || 0) + 1;
    }
  }

  return `
# Deterministic data Safety Summary

This dataset has been anonymized for non-production use.

## Applied Protections
${Object.entries(strategyCount)
  .map(([k, v]) => `- **${k}** applied to ${v} columns`)
  .join("\n")}

## Excluded Data
The following tables were explicitly excluded from anonymization:
${denylisted.length ? denylisted.map(t => `- ${t}`).join("\n") : "- None"}

## Verification
- No direct personal identifiers remain in plaintext
- Anonymization was applied deterministically
- Dataset is suitable for development, QA, demos, and vendor sharing
`;
}



