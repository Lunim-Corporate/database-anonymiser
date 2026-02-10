import { PlannedColumn, PlannedTable } from "../planner/plan-types";

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

export function buildUpdateSql(params: {
  schema: string;
  table: string;
  columns: PlannedColumn[];
}): { sql: string; values: any[] } {
  const { schema, table, columns } = params;

  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const c of columns) {
    const col = quoteIdent(c.column);

    switch (c.strategy) {
      case "KEEP":
        continue;

      case "SET_NULL":
        sets.push(`${col} = NULL`);
        continue;

      case "REDACT":
        sets.push(`${col} = '***'`);
        continue;

      case "HASH_SHA256":
        sets.push(`${col} = md5(COALESCE(${col}::text, ''))`);
        continue;

      case "TRUNCATE": {
        const n = Number((c as any).params?.n ?? 4);
        values.push(n);
        sets.push(`${col} = LEFT(COALESCE(${col}::text, ''), $${idx++})`);
        continue;
      }

      case "EMAIL_FAKE":
        sets.push(`${col} = (md5(COALESCE(${col}::text,'')) || '@example.com')`);
        continue;

      default:
        // unknown strategy => safest no-op
        continue;
    }
  }

  if (sets.length === 0) {
    return { sql: "", values: [] };
  }

  const sql = `
    UPDATE ${quoteIdent(schema)}.${quoteIdent(table)}
    SET ${sets.join(", ")}
  `.trim();

  return { sql, values };
}

/**
 * Convenience wrapper used by executor (keeps your existing executor import working).
 */
export function buildUpdateSqlForTable(table: PlannedTable): { sql: string; values: any[] } {
  return buildUpdateSql({
    schema: table.schema,
    table: table.name,
    columns: table.columns,
  });
}
