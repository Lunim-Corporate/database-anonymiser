import { Client } from "pg";
import { buildUpdateSqlForTable } from "./query-builder";
import { logger } from "../utils/logger";
import { PlannedTable, Plan, PlannedColumn } from "../planner/plan-types";
import { mapPgToGroup } from "../schema/type-mapper";

/**
 * Strategies that produce TEXT-like expressions and MUST NOT be applied to non-string columns.
 * (SET_NULL is safe across types, KEEP is no-op)
 */
//const STRING_ONLY = new Set(["EMAIL_FAKE", "HASH_SHA256", "REDACT", "TRUNCATE"]);
const STRICT_STRING_ONLY = new Set(["EMAIL_FAKE", "REDACT", "TRUNCATE"]);
const TEXT_COMPATIBLE = new Set(["HASH_SHA256"]);


/**
 * Read column types for a table from information_schema
 */
async function readColumnGroups(
  client: Client,
  schema: string,
  table: string
): Promise<Record<string, string>> {
  const sql = `
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const res = await client.query(sql, [schema, table]);

  const out: Record<string, string> = {};
  for (const r of res.rows) {
    const col = String(r.column_name);
    const dataType = String(r.data_type ?? "");
    const udt = String(r.udt_name ?? "");
    out[col] = mapPgToGroup(dataType, udt); // returns group like STRING/NUMBER/BOOLEAN/DATE/JSON/UUID/OTHER
  }
  return out;
}

/**
 * If a column is not STRING, downgrade string-only strategies to KEEP (log it).
 * SET_NULL remains allowed.
 */
function normalizeColumnsForTypes(args: {
  tableFull: string;
  columns: PlannedColumn[];
  colGroups: Record<string, string>;
}): PlannedColumn[] {
  const { tableFull, columns, colGroups } = args;

  return columns.map((c) => {
    const group = colGroups[c.column] || "OTHER";
    const strategy = c.strategy;

    // Keep/Set Null always okay (SET_NULL may fail if NOT NULL constraint; that’s valid schema behavior)
    if (strategy === "KEEP" || strategy === "SET_NULL") return c;

    // // If non-string column got string-only strategy, downgrade
    // if (STRING_ONLY.has(strategy) && group !== "STRING") {
    //   logger.warn(
    //     `[type-safety] ${tableFull}.${c.column} is ${group}. Strategy "${strategy}" not compatible. Downgrading to "KEEP".`
    //   );
    //   return { ...c, strategy: "KEEP" as any };
    // }

    // STRICT string-only strategies must only apply to STRING columns
    if (STRICT_STRING_ONLY.has(strategy) && group !== "STRING") {
      logger.warn(
        `[type-safety] ${tableFull}.${c.column} is ${group}. Strategy "${strategy}" not compatible. Downgrading to "KEEP".`
      );
      return { ...c, strategy: "KEEP" as any };
    }

    // HASH_SHA256 is allowed for STRING and OTHER
    if (strategy === "HASH_SHA256" && !["STRING", "OTHER"].includes(group)) {
      logger.warn(
        `[type-safety] ${tableFull}.${c.column} is ${group}. Strategy "${strategy}" not compatible. Downgrading to "KEEP".`
      );
      return { ...c, strategy: "KEEP" as any };
    }

    return c;
  });
}

export async function executePlan({
  client,
  plan,
  dryrun,
}: {
  client: Client;
  plan: Plan;
  dryrun: boolean;
}): Promise<{ updatedByTable: Record<string, number> }> {
  const updatedByTable: Record<string, number> = {};

  if (dryrun) {
    logger.info("Starting DRY RUN transaction");
    await client.query("BEGIN");
  }

  try {
    for (const table of plan.tables as PlannedTable[]) {
      const tableFull = table.table;

      // Normalize column strategies by DB type before building SQL
      const colGroups = await readColumnGroups(client, table.schema, table.name);
      const normalizedTable: PlannedTable = {
        ...table,
        columns: normalizeColumnsForTypes({
          tableFull,
          columns: table.columns,
          colGroups,
        }),
      };

      const { sql, values } = buildUpdateSqlForTable(normalizedTable);

      if (!sql) {
        updatedByTable[tableFull] = 0;
        logger.info(`Skipping ${tableFull} (no changes)`);
        continue;
      }

      const res = await client.query(sql, values);
      updatedByTable[tableFull] = res.rowCount ?? 0;

      logger.info(
        `${dryrun ? "[dryrun]" : "[apply]"} ${tableFull}: ${res.rowCount ?? 0} rows`
      );
    }

    if (dryrun) {
      await client.query("ROLLBACK");
      logger.info("Dry run completed — transaction rolled back");
    }

    return { updatedByTable };
  } catch (err) {
    if (dryrun) {
      await client.query("ROLLBACK");
      logger.warn("Dry run failed — rolled back");
    }
    throw err;
  }
}
