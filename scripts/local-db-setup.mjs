// Explicit operator command for a NEW demo database, never run on app startup.
import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured.");
const result = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push"], {
  stdio: "inherit", env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;