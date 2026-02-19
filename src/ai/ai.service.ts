// import { heuristicScan } from "./ai.heuristics";
// import { llmExplain, llmScan } from "./ai.llm";
// import { AiScanResult } from "./ai.types";

// export const aiService = {
//   async classify(args: any): Promise<AiScanResult> {
//     const llm = await llmScan(args);
//     return llm ?? heuristicScan(args);
//   },

//   applyRecommendationsToConfig(config: any, rec: { column_strategy: Record<string, string[]> }) {
//     // merge into config.column_strategy
//     const next = { ...config };
//     next.column_strategy = next.column_strategy || {};

//     for (const [strategy, cols] of Object.entries(rec.column_strategy || {})) {
//       const existing = Array.isArray(next.column_strategy[strategy]) ? next.column_strategy[strategy] : [];
//       next.column_strategy[strategy] = Array.from(new Set([...existing, ...cols]));
//     }
//     return next;
//   },

//   async explainSafety(args: { config: any; ai: any }) {
//     const llm = await llmExplain(args);
//     if (llm) return llm;

//     // heuristic explanation
//     const { config, ai } = args;
//     const cs = config.column_strategy || {};
//     return `
// This dataset is anonymized for non-production use.

// What we anonymize:
// - Emails: ${JSON.stringify(cs.EMAIL_FAKE || [])}
// - Tokens/secrets: ${JSON.stringify(cs.SET_NULL || [])}
// - Identifiers (hashed): ${JSON.stringify(cs.HASH_SHA256 || [])}
// - Free-text / personal fields (redacted): ${JSON.stringify(cs.REDACT || [])}

// Risk summary:
// - High risk fields detected: ${ai?.riskSummary?.high ?? 0}
// - Medium risk fields detected: ${ai?.riskSummary?.medium ?? 0}
// - Low risk fields detected: ${ai?.riskSummary?.low ?? 0}

// This is designed for development, QA, demos, and vendor sharing.
// `.trim();
//   },
// };


// import { llmScan } from "./ai.llm";
// import { heuristicScan } from "./ai.heuristics";
// import { AiRiskResult, AiExplainInput } from "./ai.types";

// const cache = new Map<string, AiRiskResult>();

// export const aiService = {
//   async classify(input: {
//     projectId?: string;
//     schema: string;
//     tables: any[];
//     samples: any;
//   }): Promise<AiRiskResult> {
//     const key = input.projectId || JSON.stringify(input.tables);

//     if (cache.has(key)) return cache.get(key)!;

//     const llm = await llmScan(input.schema, input.tables, input.samples);

//     const result = llm ?? heuristicScan(input.schema, input.tables);

//     cache.set(key, result);
//     return result;
//   },

//   async explainSafety({ config, ai }: AiExplainInput): Promise<string> {
//     const high = Object.values(ai.riskByColumn).filter(v => v === "HIGH").length;
//     const med = Object.values(ai.riskByColumn).filter(v => v === "MEDIUM").length;
//     const low = Object.values(ai.riskByColumn).filter(v => v === "LOW").length;

//     return `
// This dataset has been anonymized for non-production use.

// What was anonymized:
// - Emails: ${ai.recommendations.EMAIL_FAKE?.join(", ") || "none"}
// - Identifiers (hashed): ${ai.recommendations.HASH_SHA256?.join(", ") || "none"}
// - Free-text fields (redacted): ${ai.recommendations.REDACT?.join(", ") || "none"}
// - Tokens/secrets removed: ${ai.recommendations.SET_NULL?.join(", ") || "none"}

// Risk summary:
// - High risk fields detected: ${high}
// - Medium risk fields detected: ${med}
// - Low risk fields detected: ${low}

// This dataset is suitable for development, QA, demos, and vendor sharing.
// `.trim();
//   },
// };


import { buildPlan } from "../planner/plan-builder";
import { StrategyName } from "../config/generated-config.types";
import { llmComplete  } from "./ai.llm";
import { logger } from "../utils/logger";

/**
 * Types
 */
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

import YAML from "yaml";

function parseYamlSafely(text: string): any {
  return YAML.parse(text);
}

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



/**
 * ---------------------------------------------------------
 * STEP 3 AI — Recommend global column_strategy (YAML)
 * ---------------------------------------------------------
 *
 * This is advisory only.
 * Output is copy-pasteable into anonymizer.config.yaml
 */
// export async function recommendColumnStrategyYAML(input: {
//   config: any;
//   samples: any;
//   tablesList: string[];
// }): Promise<AiRecommendationResult> {
//   const { config } = input;

//   // Extract all unique column names from rules (GLOBAL)
//   //const allColumns = extractGlobalColumnsFromRules(config.rules);

//   const allColumnsFull = extractGlobalColumnsFromRules(config.rules);

// const MAX_COLUMNS = 300;
// const allColumns =
//   allColumnsFull.length > MAX_COLUMNS
//     ? allColumnsFull.slice(0, MAX_COLUMNS)
//     : allColumnsFull;


// //   const prompt = `
// // You are a data privacy engineer.

// // Task:
// // Recommend a GLOBAL "column_strategy" block for anonymizer.config.yaml.

// // STRICT RULES:
// // - Output ONLY valid YAML
// // - Top-level key MUST be: column_strategy
// // - Use ONLY the column names provided
// // - Do NOT invent columns
// // - Do NOT repeat a column under multiple strategies
// // - Prefer KEEP unless clearly sensitive
// // - Do NOT include explanations

// // Available strategies:
// // KEEP
// // EMAIL_FAKE
// // HASH_SHA256
// // REDACT
// // SET_NULL
// // TRUNCATE

// // Columns:
// // ${allColumns.map((c) => `- ${c}`).join("\n")}

// // Return YAML in this exact format:

// // column_strategy:
// //   KEEP:
// //     - example_column
// //   EMAIL_FAKE:
// //     - example_column
// //   HASH_SHA256:
// //     - example_column
// //   REDACT:
// //     - example_column
// //   SET_NULL:
// //     - example_column
// // `;
//   const prompt = `
// You are a senior data privacy engineer.

// Generate a GLOBAL "column_strategy" YAML block.

// STRICT RULES:
// - Output ONLY valid YAML.
// - Top-level key must be: column_strategy
// - Include EVERY column listed below.
// - Each column must appear EXACTLY ONCE.
// - Do NOT invent columns.
// - Do NOT repeat columns.
// - Use ONLY these strategies:
//   KEEP
//   EMAIL_FAKE
//   HASH_SHA256
//   REDACT
//   SET_NULL
// - Return YAML in this exact format:
//     column_strategy:
//       KEEP:
//         - example_column1
//         - example_column2
//         .....
//       EMAIL_FAKE:
//         - example_column1
//         - example_column2
//         .....
//       HASH_SHA256:
//         - example_column1
//         - example_column2
//         .....
//       REDACT:
//         - example_column1
//         - example_column2
//       SET_NULL:
//         - example_column1
//         - example_column2
// - If unsure, default to KEEP.
// - Use proper YAML list format with "-" (not inline arrays).

// Columns (unique across all tables):

// ${allColumns.join("\n")}

// Return YAML only.
// `;

//   try {
//     const llmOutput = await llmComplete(prompt);

//     if (!llmOutput) {
//       logger.warn("LLM unavailable — returning fallback YAML");
//       return {
//         yaml: fallbackRecommendationYamlFromRules(config.rules),
//         source: "heuristic",
//       };
//     }

//     return {
//       yaml: llmOutput.trim(),
//       source: "llm",
//     };
//   } catch {
//     logger.warn("LLM recommendation failed — fallback used");
//     return {
//       yaml: fallbackRecommendationYamlFromRules(config.rules),
//       source: "heuristic",
//     };
//   }
// }


/**
 * Fallback YAML if LLM is unavailable
 */
// function fallbackRecommendationYamlFromRules(rules: any[]): string {
//   const grouped: Record<string, Set<string>> = {
//     KEEP: new Set(),
//     EMAIL_FAKE: new Set(),
//     HASH_SHA256: new Set(),
//     REDACT: new Set(),
//     SET_NULL: new Set(),
//     TRUNCATE: new Set(),
//   };

//   for (const rule of rules) {
//     for (const col of rule.columns ?? []) {
//       grouped[col.strategy]?.add(col.column);
//     }
//   }

//   const lines: string[] = [];
//   lines.push("column_strategy:");

//   for (const [strategy, cols] of Object.entries(grouped)) {
//     if (cols.size === 0) continue;

//     lines.push(`  ${strategy}:`);
//     for (const c of Array.from(cols).sort()) {
//       lines.push(`    - ${c}`);
//     }
//   }

//   return lines.join("\n");
// }

function fallbackRecommendationYamlFromRules(rules: any[]): string {
  const allColumns = extractGlobalColumnsFromRules(rules);

  const globalMap: Record<string, string> = {};

  for (const col of allColumns) {
    globalMap[col] = deterministicStrategy(col);
  }

  return buildFinalYaml(globalMap);
}


// function fallbackRecommendationYamlFromRules(rules: any[]): string {
//   const allColumns = extractGlobalColumnsFromRules(rules);

//   const grouped: Record<string, string[]> = {
//     KEEP: [],
//     EMAIL_FAKE: [],
//     HASH_SHA256: [],
//     REDACT: [],
//     SET_NULL: [],
//   };

//   for (const col of allColumns) {
//     const lc = col.toLowerCase();

//     if (lc.includes("email")) {
//       grouped.EMAIL_FAKE.push(col);
//     } else if (
//       lc.includes("password") ||
//       lc.includes("token") ||
//       lc.includes("secret")
//     ) {
//       grouped.SET_NULL.push(col);
//     } else if (
//       lc.includes("phone") ||
//       lc.includes("mobile") ||
//       lc.includes("username") ||
//       lc.includes("user_id")
//     ) {
//       grouped.HASH_SHA256.push(col);
//     } else if (
//       lc.includes("name") ||
//       lc.includes("address") ||
//       lc.includes("notes")
//     ) {
//       grouped.REDACT.push(col);
//     } else {
//       grouped.KEEP.push(col);
//     }
//   }

//   const lines: string[] = [];
//   lines.push("column_strategy:");

//   for (const strategy of [
//     "KEEP",
//     "EMAIL_FAKE",
//     "HASH_SHA256",
//     "REDACT",
//     "SET_NULL",
//   ]) {
//     const cols = grouped[strategy].sort();
//     if (!cols.length) continue;

//     lines.push(`  ${strategy}:`);
//     for (const col of cols) {
//       lines.push(`    - ${col}`);
//     }
//   }

//   return lines.join("\n");
// }


/**
 * ---------------------------------------------------------
 * STEP 5 AI — Explain My Data Safety (proof.md)
 * ---------------------------------------------------------
 *
 * Client-facing explanation.
 * Based ONLY on actual applied strategies.
 */
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

/**
 * Deterministic fallback explanation
 */
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



