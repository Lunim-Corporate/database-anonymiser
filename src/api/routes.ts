// import type { Express } from "express";
// import { z } from "zod";
// import { projectStore } from "../platform/project-store";
// import { validate } from "./validators";
// import { aiService } from "../ai/ai.service";
// import { generateConfig } from "../config/config-generator";
// import { writeYaml, readGeneratedConfig } from "../config/config-io";
// import { buildPlan } from "../planner/plan-builder";
// import { executePlan } from "../executor/executor";
// import { writeJsonReport } from "../reporting/report-writer";
// import { createCloneDb } from "../platform/db-clone";
// import { exportVendorSql } from "../platform/export";
// import { buildProofBundle } from "../platform/proof";
// import { withPgClientFromConn } from "../platform/platform.types";
// import { logger } from "../utils/logger";

// function paramToString(p: string | string[]): string {
//   if (Array.isArray(p)) return p[0];
//   return p;
// }


// export function registerRoutes(app: Express) {
//   // 1) Create a new “project” (session)
//   app.post("/projects", async (_req: any, res: any) => {
//     const p = projectStore.createProject();
//     res.json(p);
//   });

//   // 2) Save connection details (read-only is enough for scan)
//   app.post(
//     "/projects/:id/connect",
//     validate(
//       z.object({
//         body: z.object({
//           connectionString: z.string().min(10),
//           schema: z.string().default("public"),
//         }),
//       })
//     ),
//     async (req: any, res: any) => {
//       const id = paramToString(req.params.id);
//       const { connectionString, schema } = (req as any).validated.body;

//       projectStore.setConnection(id, { connectionString, schema });
//       res.json({ ok: true });
//     }
//   );

//   // 3) Scan risk (schema + masked samples + AI classification)
//   app.post("/projects/:id/scan", async (req: any, res: any) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);

//     const conn = project.connection;
//     if (!conn) return res.status(400).json({ error: "No connection set" });

//     const { connectionString, schema } = conn;

//     const { config, tablesList, samplePreview } = await withPgClientFromConn(
//       connectionString,
//       async (client) => {
//         return generateConfig({
//           client,
//           schema,
//           sampleLimit: 3,
//           unsafeSamples: false,
//         });
//       }
//     );

//     // Persist artifacts in project workspace (in-memory demo store)
//     projectStore.setArtifacts(id, {
//       config,
//       samples: { tables_list: tablesList, samples: samplePreview },
//     });

//     const ai = await aiService.classify({
//       schema,
//       tablesList,
//       samples: samplePreview,
//       config,
//     });

//     projectStore.setAi(id, ai);

//     res.json({
//       schema,
//       tablesCount: tablesList.length,
//       riskSummary: ai.riskSummary,
//       recommendations: ai.recommendations,
//     });
//   });

//   // 4) Generate recommended config (AI → column_strategy + overrides)
//   app.post("/projects/:id/plan", async (req: any, res: any) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);

//     if (!project.artifacts?.config || !project.ai)
//       return res.status(400).json({ error: "Run /scan first" });

//     const updated = aiService.applyRecommendationsToConfig(
//       project.artifacts.config,
//       project.ai.recommendations
//     );

//     projectStore.setArtifacts(id, {
//       ...project.artifacts,
//       config: updated,
//     });

//     res.json({ ok: true, config: updated });
//   });

//   // 5) Explain safety (Cake 4)
//   app.post("/projects/:id/explain", async (req: any, res: any) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);
//     if (!project.artifacts?.config || !project.ai)
//       return res.status(400).json({ error: "Run /scan and /plan first" });

//     const explanation = await aiService.explainSafety({
//       config: project.artifacts.config,
//       ai: project.ai,
//     });

//     projectStore.setProof(id, { explanation });
//     res.json({ ok: true, explanation });
//   });

//   // 6) Dryrun (rows, report)
//   app.post("/projects/:id/dryrun", async (req: any, res: any) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);
//     const conn = project.connection;
//     if (!conn) return res.status(400).json({ error: "No connection set" });
//     if (!project.artifacts?.config)
//       return res.status(400).json({ error: "Run /scan first" });

//     const plan = buildPlan(project.artifacts.config);

//     const dryrunResult = await withPgClientFromConn(
//       conn.connectionString,
//       async (client) => executePlan({ client, plan, dryrun: true })
//     );

//     const totalRowsEstimated = Object.values(dryrunResult.updatedByTable).reduce(
//       (a, b) => a + b,
//       0
//     );

//     projectStore.setReports(id, { dryrun: { plan, dryrunResult, totalRowsEstimated } });

//     res.json({ totalRowsEstimated, updatedByTable: dryrunResult.updatedByTable });
//   });

//   // 7) Apply (clone + apply + export + proof bundle)
//   // For demo: clone into a new DB name and apply there.
//   app.post(
//     "/projects/:id/apply",
//     validate(
//       z.object({
//         body: z.object({
//           cloneDbName: z.string().min(3),
//           reviewed: z.boolean().default(true),
//         }),
//       })
//     ),
//     async (req: any, res: any) => {
//       const id = paramToString(req.params.id);
//       const project = projectStore.getProject(id);
//       const conn = project.connection;
//       if (!conn) return res.status(400).json({ error: "No connection set" });
//       if (!project.artifacts?.config)
//         return res.status(400).json({ error: "Run /scan first" });

//       // mark reviewed
//       const cfg = { ...project.artifacts.config, reviewed: true };

//       // Create clone DB (same host, uses pg_dump/psql under the hood)
//       await createCloneDb({
//         sourceConnString: conn.connectionString,
//         targetDbName: (req as any).validated.body.cloneDbName,
//       });

//       const cloneConnString = conn.connectionString.replace(
//         /dbname=([^\s]+)/,
//         `dbname=${(req as any).validated.body.cloneDbName}`
//       );

//       const plan = buildPlan(cfg);

//       const applyResult = await withPgClientFromConn(cloneConnString, async (client) => {
//         await client.query("BEGIN");
//         try {
//           const r = await executePlan({ client, plan, dryrun: false });
//           await client.query("COMMIT");
//           return r;
//         } catch (e) {
//           await client.query("ROLLBACK");
//           throw e;
//         }
//       });

//       projectStore.setReports(id, { ...(project.reports || {}), apply: { plan, applyResult } });

//       // Vendor-safe export (SQL dump)
//       const exportSql = await exportVendorSql({ connString: cloneConnString });

//       // Proof bundle (zip later; for demo we store strings)
//       const proof = await buildProofBundle({
//         config: cfg,
//         ai: project.ai,
//         dryrun: project.reports?.dryrun,
//         apply: { plan, applyResult },
//         vendorExportSql: exportSql,
//         explanation: project.proof?.explanation || "",
//       });

//       projectStore.setFinal(id, {
//         cloneDbName: (req as any).validated.body.cloneDbName,
//         vendorExportSql: exportSql,
//         proof,
//       });

//       logger.info(`Project ${id} apply completed`);
//       res.json({
//         ok: true,
//         cloneDbName: (req as any).validated.body.cloneDbName,
//         tablesUpdated: Object.keys(applyResult.updatedByTable).length,
//       });
//     }
//   );

//   // Fetch “final outputs” (proof + export)
//   app.get("/projects/:id/final", async (req: any, res: any) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);
//     if (!project.final) return res.status(404).json({ error: "Not ready" });
//     res.json(project.final);
//   });

//   app.get("/projects/:id", (req, res) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);
//     res.json(project);
//   });

//   app.get("/projects/:id/debug", (req, res) => {
//     const id = paramToString(req.params.id);
//     const project = projectStore.getProject(id);
//     res.json(project);
//   });


// }


import type { Express } from "express";
import { z } from "zod";
import multer from "multer";
import archiver from "archiver";

import { validate } from "./validators";
import { projectStore } from "../platform/project-store";
import { withPgClientFromConn } from "../platform/platform.types";

import { generateConfig } from "../config/config-generator";
import { buildPlan } from "../planner/plan-builder";
import { executePlan } from "../executor/executor";

//import { aiService } from "../ai/ai.service";
import {
  recommendColumnStrategyYAML,
  explainSafety,
} from "../ai/ai.service";

import { toYamlString, parseGeneratedConfigFromYamlString } from "../config/config-io";
import { exportVendorSql } from "../platform/export";
import { createCloneDb } from "../platform/db-clone";
import { logger } from "../utils/logger";
import type { TableRule, TableColumnRule } from "../config/generated-config.types";
import { writeJsonReport } from "../reporting/report-writer";


function paramToString(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p;
}

const upload = multer({ storage: multer.memoryStorage() });

function sendZip(res: any, zipName: string, files: { name: string; content: string }[]) {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(res);

  for (const f of files) {
    archive.append(f.content, { name: f.name });
  }

  archive.finalize();
}

export function registerRoutes(app: Express) {
  // 1) Create Project
  app.post("/projects", async (_req, res) => {
    const p = projectStore.createProject();
    res.json(p);
  });

  // 2) Connect DB (store only)
  app.post(
    "/projects/:id/connect",
    validate(
      z.object({
        body: z.object({
          connectionString: z.string().min(10),
        }),
      })
    ),
    async (req, res) => {
      const id = paramToString(req.params.id);
      const { connectionString } = (req as any).validated.body;

      // no schema in UI — set default schema in server/env
      const schema = process.env.DEFAULT_SCHEMA || "public";

      projectStore.setConnection(id, { connectionString, schema });
      res.json({ ok: true });
    }
  );

  // 3) configGen → download ZIP (config + samples)
  // app.post("/projects/:id/configGen", async (req, res) => {
  //   const id = paramToString(req.params.id);
  //   const project = projectStore.getProject(id);

  //   if (!project.connection) return res.status(400).json({ error: "Connect DB first" });

  //   const { connectionString, schema } = project.connection;

  //   const { config, tablesList, samplePreview } = await withPgClientFromConn(
  //     connectionString,
  //     async (client) => {
  //       return generateConfig({
  //         client,
  //         schema,
  //         sampleLimit: Number(process.env.SAMPLE_LIMIT || 3),
  //         unsafeSamples: false,
  //       });
  //     }
  //   );

  //   const samplesObj = { tables_list: tablesList, samples: samplePreview };

  //   // store artifacts in memory (still useful)
  //   projectStore.setArtifacts(id, {
  //     config,
  //     samples: samplesObj,
  //   });

  //   // return ZIP download like CLI output
  //   const configYaml = toYamlString(config);
  //   const samplesYaml = toYamlString(samplesObj);

  //   return sendZip(res, `anonymizer-configGen-${id}.zip`, [
  //     { name: "anonymizer.config.yaml", content: configYaml },
  //     { name: "anonymizer.samples.yaml", content: samplesYaml },
  //   ]);
  // });

  // app.post("/projects/:id/configGen", async (req, res) => {
  //   const id = paramToString(req.params.id);
  //   const project = projectStore.getProject(id);

  //   if (!project.connection) {
  //     return res.status(400).json({ error: "Connect DB first" });
  //   }

  //   const { connectionString, schema } = project.connection;

  //   const { config, tablesList, samplePreview } =
  //     await withPgClientFromConn(connectionString, async (client) =>
  //       generateConfig({
  //         client,
  //         schema,
  //         sampleLimit: Number(process.env.SAMPLE_LIMIT || 3),
  //         unsafeSamples: false,
  //       })
  //     );

  //   const samplesObj = {
  //     tables_list: tablesList,
  //     samples: samplePreview,
  //   };

  //   projectStore.setArtifacts(id, { config, samples: samplesObj });

  //   // 🔥 NEW: AI recommendation (YAML format)
  //   const aiRecommendation =
  //     await recommendColumnStrategyYAML({
  //       config,
  //       samples: samplesObj,
  //       tablesList,
  //     });

  //   const zipFiles = [
  //     { name: "anonymizer.config.yaml", content: toYamlString(config) },
  //     { name: "anonymizer.samples.yaml", content: toYamlString(samplesObj) },
  //   ];

  //   res.setHeader("Content-Type", "application/json");
  //   res.json({
  //     download: {
  //       zip: zipFiles,
  //     },
  //     ai: {
  //       recommended_column_strategy: aiRecommendation.yaml,
  //       source: aiRecommendation.source, 
  //     },
  //   });
  // });

  app.post("/projects/:id/configGen", async (req, res) => {
    const id = paramToString(req.params.id);
    const project = projectStore.getProject(id);

    if (!project.connection) {
      return res.status(400).json({ error: "Connect DB first" });
    }

    const { connectionString, schema } = project.connection;

    const { config, tablesList, samplePreview } =
      await withPgClientFromConn(connectionString, async (client) =>
        generateConfig({
          client,
          schema,
          sampleLimit: Number(process.env.SAMPLE_LIMIT || 3),
          unsafeSamples: false,
        })
      );

    const samplesObj = {
      tables_list: tablesList,
      samples: samplePreview,
    };

    projectStore.setArtifacts(id, { config, samples: samplesObj });

    const zipFiles = [
      { name: "anonymizer.config.yaml", content: toYamlString(config) },
      { name: "anonymizer.samples.yaml", content: toYamlString(samplesObj) },
    ];

    res.json({
      download: {
        zip: zipFiles,
      },
    });
  });

  app.post("/projects/:id/recommend", async (req, res) => {
    const id = paramToString(req.params.id);
    const project = projectStore.getProject(id);

    if (!project.artifacts?.config) {
      return res.status(400).json({ error: "Generate config first" });
    }

    const { config, samples } = project.artifacts;

    const aiRecommendation =
      await recommendColumnStrategyYAML({
        config,
        samples,
      });

    res.json({
      recommended_column_strategy: aiRecommendation.yaml,
      source: aiRecommendation.source,
    });
  });




  // 4) Upload edited config (required before dryrun/apply)
  app.post("/projects/:id/upload/config", upload.single("file"), async (req, res) => {
    const id = paramToString(req.params.id);
    const project = projectStore.getProject(id);

    if (!req.file) return res.status(400).json({ error: "Missing file" });

    const yamlText = req.file.buffer.toString("utf8");
    const cfg = parseGeneratedConfigFromYamlString(yamlText);

    projectStore.setUploadedConfig(id, cfg);

    res.json({ ok: true });
  });

  // 5) Explain safety → download proof.md
  app.post("/projects/:id/explain", async (req, res) => {
    const id = paramToString(req.params.id);
    const project = projectStore.getProject(id);

    const cfg = project.uploadedConfig || project.artifacts?.config;
    if (!cfg) return res.status(400).json({ error: "Upload config first" });

    // AI scan can be recomputed or reused; for now: compute from config + samples if available
    // const ai = project.ai || (await aiService.classify({
    //   projectId: id,
    //   schema: cfg.scope?.schema || (project.connection?.schema ?? "public"),
    //   tables: cfg.rules.map((r: TableRule) => ({
    //     table: r.table,
    //     columns: r.columns.map((c: TableColumnRule) => c.column),
    //   })),
    //   samples: project.artifacts?.samples?.samples || {},
    // }));


    //projectStore.setAi(id, ai);

    //const explanation = await aiService.explainSafety({ config: cfg, ai });

    const plan = buildPlan(cfg);

    const explanation = await explainSafety({
      config: cfg,
      plan,
    });

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="proof-${id}.md"`);
    res.send(explanation);
  });

  // 6) Dryrun → download dryrun report JSON (CLI-compatible)
  app.post("/projects/:id/dryrun", async (req, res) => {
    const id = paramToString(req.params.id);
    const project = projectStore.getProject(id);

    if (!project.connection) {
      return res.status(400).json({ error: "Connect DB first" });
    }

    const cfg = project.uploadedConfig;
    if (!cfg) {
      return res.status(400).json({ error: "Upload config first" });
    }

    // Build plan exactly like CLI
    const plan = buildPlan(cfg);

    // Execute dryrun exactly like CLI
    const result = await withPgClientFromConn(
      project.connection.connectionString,
      async (client) => {
        return executePlan({ client, plan, dryrun: true });
      }
    );

    const totalRowsEstimated = Object.values(result.updatedByTable)
      .reduce((a, b) => a + b, 0);

    // ✅ CLI-COMPATIBLE REPORT SHAPE
    const report = {
      mode: "dryrun",
      generatedAt: new Date().toISOString(),
      plan,
      result,
      totalRowsEstimated,
    };

    // Store internally (optional but useful)
    projectStore.setReports(id, {
      ...(project.reports || {}),
      dryrun: report,
    });

    // Download exactly like CLI
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="anonymize.dryrun.report.${id}.json"`
    );

    res.send(JSON.stringify(report, null, 2));
  });


  // 7) Apply → download ZIP bundle (apply report + export + proof + config)
  app.post(
    "/projects/:id/apply",
    validate(
      z.object({
        body: z.object({
          cloneDbName: z.string().min(3),
        }),
      })
    ),
    async (req, res) => {
      const id = paramToString(req.params.id);
      const project = projectStore.getProject(id);

      if (!project.connection) return res.status(400).json({ error: "Connect DB first" });

      const cfg = project.uploadedConfig;
      if (!cfg) return res.status(400).json({ error: "Upload config first" });

      const { cloneDbName } = (req as any).validated.body;

      // clone db
      await createCloneDb({
        sourceConnString: project.connection.connectionString,
        targetDbName: cloneDbName,
      });

      // IMPORTANT: we keep it simple here; for URL conn strings, we’ll add a robust function next if needed
      const cloneConnString = project.connection.connectionString.replace(
        /\/([^\/\?]+)(\?|$)/,
        `/${cloneDbName}$2`
      );

      const plan = buildPlan({ ...cfg, reviewed: true });

      // apply on clone
      const applyResult = await withPgClientFromConn(cloneConnString, async (client) => {
        await client.query("BEGIN");
        try {
          const r = await executePlan({ client, plan, dryrun: false });
          await client.query("COMMIT");
          return r;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }
      });

      const appliedRows = Object.values(applyResult.updatedByTable).reduce((a, b) => a + b, 0);

      const applyReport = {
        mode: "apply",
        generatedAt: new Date().toISOString(),
        cloneDbName,
        totalRowsApplied: appliedRows,
        updatedByTable: applyResult.updatedByTable,
        planSummary: { tables: plan.tables.length },
      };

      projectStore.setReports(id, { ...(project.reports || {}), apply: applyReport });

      // vendor export
      const vendorSql = await exportVendorSql({ connString: cloneConnString });

      // explanation (proof)
      // const ai = project.ai || (await aiService.classify({
      //   projectId: id,
      //   schema: cfg.scope?.schema || (project.connection?.schema ?? "public"),
      //   tables: cfg.rules.map((r: TableRule) => ({
      //     table: r.table,
      //     columns: r.columns.map((c: TableColumnRule) => c.column),
      //   })),
      //   samples: project.artifacts?.samples?.samples || {},
      // }));


      const explanation = await explainSafety({ config: cfg, plan });

      // bundle
      const cfgYaml = toYamlString(cfg);
      const proofMd = explanation;

      logger.info(`Apply completed for project ${id}. clone=${cloneDbName}`);

      return sendZip(res, `proof-bundle-${id}.zip`, [
        { name: "anonymizer.config.yaml", content: cfgYaml },
        { name: "proof.md", content: proofMd },
        { name: `anonymize.apply.report.${id}.json`, content: JSON.stringify(applyReport, null, 2) },
        { name: `vendor_export.${id}.sql`, content: vendorSql },
      ]);
    }
  );
}
