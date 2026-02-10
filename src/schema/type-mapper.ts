// src/schema/type-mapper.ts

export type ColumnTypeGroup =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "JSON"
  | "UUID"
  | "OTHER";

export function mapPgToGroup(dataType: string, udtName?: string): ColumnTypeGroup {
  const dt = (dataType || "").toLowerCase();
  const udt = (udtName || "").toLowerCase();

  // Prefer udt_name when available (e.g., int4, int8, bool, uuid)
  const t = udt || dt;

  // STRING-ish
  if (
    dt.includes("character") ||
    dt.includes("text") ||
    t.includes("varchar") ||
    t.includes("bpchar") ||
    t.includes("char") ||
    t === "citext"
  ) {
    return "STRING";
  }

  // NUMBER-ish
  if (
    t.includes("int") ||
    t.includes("numeric") ||
    t.includes("decimal") ||
    t.includes("float") ||
    t.includes("double") ||
    t.includes("real")
  ) {
    return "NUMBER";
  }

  // BOOLEAN
  if (t === "bool" || dt === "boolean") return "BOOLEAN";

  // DATE/TIME
  if (
    dt.includes("timestamp") ||
    dt.includes("date") ||
    dt.includes("time")
  ) {
    return "DATE";
  }

  // JSON
  if (t === "json" || t === "jsonb" || dt === "json" || dt === "jsonb") return "JSON";

  // UUID
  if (t === "uuid" || dt === "uuid") return "UUID";

  return "OTHER";
}
