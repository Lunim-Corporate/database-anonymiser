import "dotenv/config";
import express from "express";
import cors from "cors";
import { json } from "body-parser";
import { registerRoutes } from "./routes";
import { logger } from "../utils/logger";
import { warmupLLM } from "../ai/ai.llm";

warmupLLM().catch(() => {
  logger.warn("LLM warmup failed");
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(json({ limit: "10mb" }));

registerRoutes(app);

const port = Number(process.env.PLATFORM_PORT || 5050);
app.listen(port, () => logger.info(`Platform API listening on :${port}`));
