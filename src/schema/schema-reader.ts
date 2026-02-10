import { Client } from "pg";

export type ColumnInfo = {
  name: string;
  dataType: string;
  isNullable: boolean;
};

export type TableInfo = {
  schema: string;
  name: string;
  columns: ColumnInfo[];
};

export async function readSchema(client: Client, schema: string): Promise<TableInfo[]> {
  const tablesRes = await client.query(
    `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema = $1
    ORDER BY table_name
  `,
    [schema]
  );

  const tables: TableInfo[] = [];
  for (const t of tablesRes.rows) {
    const colsRes = await client.query(
      `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
      [t.table_schema, t.table_name]
    );

    tables.push({
      schema: t.table_schema,
      name: t.table_name,
      columns: colsRes.rows.map((r) => ({
        name: r.column_name,
        dataType: r.data_type,
        isNullable: r.is_nullable === "YES",
      })),
    });
  }

  return tables;
}
