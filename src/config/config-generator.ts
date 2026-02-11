import { Client } from "pg";
import { readSchema } from "../schema/schema-reader";
import { GeneratedConfig, TableRule } from "../config/generated-config.types";
import { maskSample } from "../pi/patterns";
import { logger } from "../utils/logger";

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

const defaultGlobalColumnStrategy = {
  KEEP: ["id", "created_at", "updated_at", "status", "type"],
  EMAIL_FAKE: ["email"],
  HASH_SHA256: ["phone", "mobile", "username"],
  REDACT: ["address"],
  SET_NULL: ["raw_payload", "debug_info"],
};



export async function generateConfig(params: {
  client: Client;
  schema: string;
  sampleLimit: number;
  unsafeSamples: boolean;
}): Promise<{ config: GeneratedConfig; tablesList: string[]; samplePreview: Record<string, any> }> {
  const { client, schema, sampleLimit, unsafeSamples } = params;

  const tables = await readSchema(client, schema);
  logger.info(`Found ${tables.length} tables in schema "${schema}"`);
  const tablesList = tables.map(
    (t) => `${t.schema}.${t.name}`
  );


  const rules: TableRule[] = [];
  const samplePreview: Record<string, any> = {};

  for (const t of tables) {
    const tableKey = `${t.schema}.${t.name}`;
    samplePreview[tableKey] = {};

    // Pull up to N rows (as json) to show examples
    // NOTE: this may be slow on huge tables; it’s okay for configGen.
    const sql = `SELECT * FROM ${quoteIdent(t.schema)}.${quoteIdent(t.name)} LIMIT ${sampleLimit}`;
    const res = await client.query(sql);

    // build per-column sample values
    for (const c of t.columns) {
      const values: any[] = [];
      for (const row of res.rows) {
        const v = row[c.name];
        if (v === null || v === undefined) continue;
        values.push(v);
        if (values.length >= sampleLimit) break;
      }

      samplePreview[tableKey][c.name] = unsafeSamples
        ? values
        : values.map((v) => maskSample(String(v)));
    }

    // default rules: enabled true, all columns KEEP
    rules.push({
      table: tableKey,
      enabled: true,
      columns: t.columns.map((c) => ({
        column: c.name,        //  NO STRATEGY BY DEFAULT
        })),
    });

  }

const config: GeneratedConfig = {
  version: 1,
  generatedAt: new Date().toISOString(),
  reviewed: false,

  scope: {
    schema,
    denylistTables: [],
  },

  samples: {
    limit: sampleLimit,
    masked: !unsafeSamples,
  },

  column_strategy: defaultGlobalColumnStrategy,   

  rules,
};


  return { config, tablesList, samplePreview };
}
