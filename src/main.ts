import "dotenv/config";
import { parseArgs } from "./cli/args";
import { loadToolConfig } from "./config/tool.config";
import { withPgClient } from "./db/postgres.client";
import { logger } from "./utils/logger";

import { generateConfig } from "./config/config-generator";
import { readGeneratedConfig, writeYaml } from "./config/config-io";
import { buildPlan } from "./planner/plan-builder";
import { executePlan } from "./executor/executor";
import { preflightValidate } from "./validators/preflight";
import { writeJsonReport } from "./reporting/report-writer";

import {
  CONFIG_FILE,
  SAMPLES_FILE,
  DRYRUN_REPORT,
  APPLY_REPORT,
} from "./config/constants";

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  const toolConfig = loadToolConfig();

  logger.info(`Running anonymizer in "${mode}" mode`);

  await withPgClient(toolConfig.db, async (client) => {
    // -----------------------------
    // CONFIG GENERATION
    // -----------------------------
    if (mode === "configGen") {
      logger.info("Generating anonymizer config from database schema...");

      const { config, tablesList, samplePreview } = await generateConfig({
        client,
        schema: "public",
        sampleLimit: 3,
        unsafeSamples: false,
      });

      writeYaml(CONFIG_FILE, config);
      writeYaml(SAMPLES_FILE, {
        tables_list: tablesList,
        samples: samplePreview,
      });

      logger.info(`Config written to ${CONFIG_FILE}`);
      logger.info(`Samples written to ${SAMPLES_FILE}`);
      logger.info(
        "Next steps:\n" +
          "1. Review samples\n" +
          "2. Edit anonymizer.config.yaml\n" +
          "3. Set reviewed: true\n" +
          "4. Run --dryrun"
      );
      return;
    }

    // -----------------------------
    // DRYRUN / APPLY
    // -----------------------------
    const config = readGeneratedConfig(CONFIG_FILE);
    preflightValidate(config, mode);

    const plan = buildPlan(config);
    logger.info(`Plan built with ${plan.tables.length} enabled tables`);

    // -----------------------------
    // DRY RUN
    // -----------------------------
    if (mode === "dryrun") {
      logger.info("Executing dry run...");

      const result = await executePlan({
        client,
        plan,
        dryrun: true,
      });

      const totalRows = Object.values(result.updatedByTable).reduce(
        (a, b) => a + b,
        0
      );

      logger.info(`Total rows affected (dry run): ${totalRows}`);

      writeJsonReport(DRYRUN_REPORT, {
        mode: "dryrun",
        plan,
        result,
        totalRowsEstimated: totalRows,
      });

      logger.info(`Dry run report written to ${DRYRUN_REPORT}`);
      return;
    }

    // -----------------------------
    // APPLY
    // -----------------------------
    logger.info("Beginning anonymization transaction...");
    await client.query("BEGIN");

    try {
      const result = await executePlan({
        client,
        plan,
        dryrun: false,
      });

      await client.query("COMMIT");

      const totalRows = Object.values(result.updatedByTable).reduce(
        (a, b) => a + b,
        0
      );

      writeJsonReport(APPLY_REPORT, {
        mode: "apply",
        plan,
        result,
        totalRowsApplied: totalRows,
      });

      logger.info(`Apply report written to ${APPLY_REPORT}`);
      logger.info("Anonymization completed successfully ✅");
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("Apply failed. Transaction rolled back ❌");
      throw err;
    }
  });
}

main().catch((err) => {
  logger.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
