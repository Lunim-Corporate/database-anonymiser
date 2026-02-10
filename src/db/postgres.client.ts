import { Client } from "pg";
import { DbConfig } from "../config/tool.config";

export async function withPgClient<T>(
  db: DbConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
