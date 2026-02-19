// // import { execSync } from "child_process";

// // export async function exportVendorSql(args: { connString: string }): Promise<string> {
// //   const { connString } = args;
// //   // plain SQL export (vendor-safe after anonymization)
// //   const out = execSync(`pg_dump "${connString}"`, { shell: "/bin/bash" });
// //   return out.toString("utf8");
// // }


// import { spawn } from "child_process";
// import fs from "fs";
// import path from "path";
// import { PgConnectionConfig } from "../utils/parsePgConn";

// export async function exportVendorSql(args: { pg: PgConnectionConfig }): Promise<string> {
//   const { pg } = args;

//   const tempFile = path.join(
//     process.cwd(),
//     `vendor_export_${Date.now()}.sql`
//   );

//   return new Promise((resolve, reject) => {
//     const dump = spawn("pg_dump", [
//       "-h", pg.host,
//       "-p", String(pg.port),
//       "-U", pg.user,
//       "-d", pg.database,
//     ], {
//       env: {
//         ...process.env,
//         PGPASSWORD: pg.password,
//       },
//     });

//     const writeStream = fs.createWriteStream(tempFile);

//     dump.stdout.pipe(writeStream);
//     dump.stderr.on("data", (data) => {
//       console.error("pg_dump error:", data.toString());
//     });

//     dump.on("close", (code) => {
//       if (code !== 0) {
//         reject(new Error(`pg_dump exited with code ${code}`));
//       } else {
//         try {
//           const content = fs.readFileSync(tempFile, "utf8");
//           fs.unlinkSync(tempFile);
//           resolve(content);
//         } catch (err) {
//           reject(err);
//         }
//       }
//     });
//   });
// }


import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export async function exportVendorSql(args: {
  connString: string;
}): Promise<string> {
  const { connString } = args;

  // ✅ SAFE parsing using URL class
  const url = new URL(connString);

  const host = url.hostname;
  const port = url.port || "5432";
  const database = url.pathname.replace("/", "");
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  const tempFile = path.join(
    process.cwd(),
    `vendor_export_${Date.now()}.sql`
  );

  return new Promise((resolve, reject) => {
    const dump = spawn(
      "pg_dump",
      [
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", database,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: password, // ✅ prevents console password prompt
        },
      }
    );

    const writeStream = fs.createWriteStream(tempFile);

    dump.stdout.pipe(writeStream);

    dump.stderr.on("data", (data) => {
      console.error("pg_dump error:", data.toString());
    });

    dump.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exited with code ${code}`));
      } else {
        try {
          const content = fs.readFileSync(tempFile, "utf8");
          fs.unlinkSync(tempFile);
          resolve(content);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
