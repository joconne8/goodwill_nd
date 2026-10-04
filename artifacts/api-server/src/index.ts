import app from "./app";
import { logger } from "./lib/logger";
import { createGoodwillRuntime } from "./goodwill/runtime";
import { authorizeOperator } from "./goodwill/operatorAuth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Verified Clerk cookie session AND the one privately configured demo email.
const goodwill = await createGoodwillRuntime(authorizeOperator);
app.use("/api/goodwill/v2", goodwill.router);

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close();
    void goodwill.close().finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
