import { execSync } from "child_process";

export async function createCloneDb(args: {
  sourceConnString: string;
  targetDbName: string;
}) {
  const { sourceConnString, targetDbName } = args;

  const url = new URL(sourceConnString);

  const sourceDb = url.pathname.replace("/", "");

  // Create new DB
  execSync(`createdb ${targetDbName}`, { stdio: "inherit" });

  // Clone URL safely
  const targetUrl = new URL(sourceConnString);
  targetUrl.pathname = `/${targetDbName}`;

  execSync(
    `pg_dump "${url.toString()}" | psql "${targetUrl.toString()}"`,
    { stdio: "inherit", shell: "/bin/bash" }
  );
}
