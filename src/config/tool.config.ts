export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
};

export type ToolConfig = {
  db: DbConfig;
};

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function loadToolConfig(): ToolConfig {
  return {
    db: {
      host: env("PGHOST", "localhost"),
      port: Number(env("PGPORT", "5432")),
      user: env("PGUSER"),
      password: env("PGPASSWORD"),
      database: env("PGDATABASE"),
      ssl: env("PGSSLMODE", "").toLowerCase() === "require",
    },
  };
}
