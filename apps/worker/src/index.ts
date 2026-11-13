import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "bullmq";
import { config as loadDotenv } from "dotenv";
import { Redis } from "ioredis";
import pino from "pino";
import { QUEUE_NAMES, SERVICE_NAMES } from "@releaseops/shared";
import { loadWorkerConfig } from "./config.js";

const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv });
}

const config = loadWorkerConfig();
const logger = pino({ level: config.logLevel, base: { service: SERVICE_NAMES.worker } });

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAMES.jobs,
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "received job");
  },
  { connection },
);

worker.on("ready", () => {
  logger.info({ queue: QUEUE_NAMES.jobs }, "worker ready");
});

worker.on("error", (error) => {
  logger.error({ err: error }, "worker error");
});

let shuttingDown = false;

async function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await worker.close();
    await connection.quit();
  } finally {
    process.exit(exitCode);
  }
}

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});
