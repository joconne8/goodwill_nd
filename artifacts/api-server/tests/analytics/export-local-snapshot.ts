import { writeFile } from "node:fs/promises";
import { AnalyticsService } from "../../src/goodwill/analytics/service";
import { seedFixturePack } from "../../src/goodwill/data";
import { setup, root, august } from "../data/helpers";

const output = process.argv.at(-1);
if (!output || output === process.argv[1]) throw new Error("Pass an output file path.");
const env = await setup();
await seedFixturePack(env.intake, root, { confirmSyntheticOnly: true, owner: "operator" },
  async (url, bytes) => { env.archive.inbox.set(url.split("/").at(-1)!, bytes); });
const snapshot = await new AnalyticsService(env.repository, env.reporting)
  .exportSupersetSnapshot({ sourceId: "shopgoodwill", period: august });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
console.log("Wrote one source-derived synthetic aggregate snapshot for local importer integration testing.");