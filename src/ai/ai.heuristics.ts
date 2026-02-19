// import { AiScanResult, ColumnRisk } from "./ai.types";

// const HIGH_KEYS = ["email", "phone", "mobile", "token", "password", "secret", "address"];
// const MED_KEYS = ["name", "username", "ip", "dob", "birth", "notes", "payload", "debug"];

// function riskForColumn(col: string) {
//   const c = col.toLowerCase();
//   if (HIGH_KEYS.some((k) => c.includes(k))) return "HIGH";
//   if (MED_KEYS.some((k) => c.includes(k))) return "MEDIUM";
//   return "LOW";
// }

// function strategyFor(col: string, risk: string) {
//   const c = col.toLowerCase();
//   if (c.includes("email")) return "EMAIL_FAKE";
//   if (c.includes("token") || c.includes("password") || c.includes("secret")) return "SET_NULL";
//   if (c.includes("phone") || c.includes("mobile") || c.includes("username")) return "HASH_SHA256";
//   if (risk === "HIGH" || c.includes("name") || c.includes("address") || c.includes("notes")) return "REDACT";
//   return "KEEP";
// }

// export function heuristicScan(args: {
//   schema: string;
//   tablesList: string[];
//   samples: Record<string, any>;
//   config: any;
// }): AiScanResult {
//   const findings: ColumnRisk[] = [];

//   // samples structure: { [tableName]: { [columnName]: ["***", "***"] } } etc
//   for (const [table, cols] of Object.entries(args.samples || {})) {
//     if (typeof cols !== "object" || !cols) continue;

//     for (const col of Object.keys(cols as any)) {
//       const risk = riskForColumn(col);
//       const strat = strategyFor(col, risk);
//       findings.push({
//         table,
//         column: col,
//         risk: risk as any,
//         reason: `Heuristic match based on column name "${col}"`,
//         recommendedStrategy: strat,
//       });
//     }
//   }

//   const column_strategy: Record<string, string[]> = {};
//   for (const f of findings) {
//     if (!column_strategy[f.recommendedStrategy]) column_strategy[f.recommendedStrategy] = [];
//     if (!column_strategy[f.recommendedStrategy].includes(f.column)) {
//       column_strategy[f.recommendedStrategy].push(f.column);
//     }
//   }

//   const summary = { high: 0, medium: 0, low: 0 };
//   for (const f of findings) {
//     if (f.risk === "HIGH") summary.high++;
//     else if (f.risk === "MEDIUM") summary.medium++;
//     else summary.low++;
//   }

//   return {
//     riskSummary: summary,
//     recommendations: { column_strategy },
//     findings,
//   };
// }


import { AiRiskResult } from "./ai.types";

const EMAIL_KEYS = ["email", "e_mail", "mail"];
const PHONE_KEYS = ["phone", "mobile"];
const NAME_KEYS = ["name"];
const TOKEN_KEYS = ["token", "secret", "password", "key"];

export function heuristicScan(schema: string, tables: any[]): AiRiskResult {
  const riskByColumn: Record<string, any> = {};
  const rec: any = {};

  for (const t of tables) {
    for (const col of t.columns) {
      const c = col.toLowerCase();

      if (EMAIL_KEYS.some(k => c.includes(k))) {
        riskByColumn[c] = "HIGH";
        rec.EMAIL_FAKE ??= [];
        rec.EMAIL_FAKE.push(c);
      } else if (PHONE_KEYS.some(k => c.includes(k))) {
        riskByColumn[c] = "HIGH";
        rec.HASH_SHA256 ??= [];
        rec.HASH_SHA256.push(c);
      } else if (TOKEN_KEYS.some(k => c.includes(k))) {
        riskByColumn[c] = "HIGH";
        rec.SET_NULL ??= [];
        rec.SET_NULL.push(c);
      } else if (NAME_KEYS.some(k => c.includes(k))) {
        riskByColumn[c] = "MEDIUM";
        rec.REDACT ??= [];
        rec.REDACT.push(c);
      } else {
        riskByColumn[c] = "LOW";
        rec.KEEP ??= [];
        rec.KEEP.push(c);
      }
    }
  }

  return { riskByColumn, recommendations: rec };
}
