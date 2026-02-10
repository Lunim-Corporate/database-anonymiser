import fs from "fs";
import YAML from "yaml";
import { z } from "zod";
import { GeneratedConfig } from "../config/generated-config.types";

const ColumnRuleZ = z.object({
  column: z.string(),
  strategy: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
});

const TableRuleZ = z.object({
  table: z.string(),
  enabled: z.boolean(),
  columns: z.array(ColumnRuleZ),
});

// const GeneratedConfigZ = z.object({
//   version: z.literal(1),
//   generatedAt: z.string(),
//   reviewed: z.boolean(),
//   scope: z.object({
//     schema: z.string(),
//     denylistTables: z.array(z.string()),
//     allowlistTables: z.array(z.string()).optional(),
//   }),
//   samples: z.object({
//     limit: z.number(),
//     masked: z.boolean(),
//   }),
//   rules: z.array(TableRuleZ),
// });

const GeneratedConfigZ = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  reviewed: z.boolean(),

  scope: z.object({
    schema: z.string(),
    denylistTables: z.array(z.string()),
    allowlistTables: z.array(z.string()).optional(),
  }),

  samples: z.object({
    limit: z.number(),
    masked: z.boolean(),
  }),

  // ✅ ADD THIS
  column_strategy: z.record(
    z.string(),
    z.union([
      z.array(z.string()),
      z.record(z.string(), z.any())
    ])
  ),

  rules: z.array(TableRuleZ),
});


export function writeYaml(filePath: string, obj: any) {
  const doc = new YAML.Document(obj);
  doc.contents = obj;
  const text = doc.toString({ indent: 2 });
  fs.writeFileSync(filePath, text, "utf8");
}

export function readGeneratedConfig(filePath: string): GeneratedConfig {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(raw);
  const cfg = GeneratedConfigZ.parse(parsed);
  return cfg as GeneratedConfig;
}
