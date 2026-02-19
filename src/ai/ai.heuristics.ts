
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
