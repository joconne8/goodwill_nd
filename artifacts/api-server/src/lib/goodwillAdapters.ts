import type { DownloadOptions, SaveOptions } from "@google-cloud/storage";
import { chromium } from "playwright";
import { privateStorageClient } from "./privateStorageClient";
import { DataError, type Storage } from "../goodwill/data";
import type { BrowserLauncher } from "../goodwill/acquisition";
import { issueReplicaCapability, revokeReplicaCapability } from "../goodwill/replicaCapability";

/** SDK metadata can declare numeric generations; never round an unsafe one. */
export const goodwillStorage: Storage = {
  bucket: name => ({
    file: (objectName, options) => {
      const generation = (options as { generation?: string } | undefined)?.generation;
      const file = privateStorageClient.bucket(name).file(objectName, generation ? { generation } : {});
      return {
        save: (bytes, options) => file.save(bytes, options as SaveOptions),
        download: options => file.download(options as DownloadOptions),
        getMetadata: async () => {
          const [metadata] = await file.getMetadata();
          if (typeof metadata.generation === "number" && !Number.isSafeInteger(metadata.generation))
            throw new DataError("STORAGE_UNAVAILABLE", "Storage returned an unsafe object generation.", 503);
          const generation = metadata.generation === undefined ? undefined : String(metadata.generation);
          return [{ ...metadata, generation }];
        },
      };
    },
  }),
};

/** Adapt current Playwright's Disposable/Response returns to the frozen lane boundary. */
export function goodwillBrowser(executablePath: string): BrowserLauncher {
  return {
    async launch(options) {
      const browser = await chromium.launch({ ...options, executablePath });
      return {
        close: () => browser.close(),
        async newContext(options) {
          const capability = issueReplicaCapability();
          let context;
          try {
            context = await browser.newContext({
              ...options, extraHTTPHeaders: { "X-Goodwill-Replica-Capability": capability },
            });
          } catch (error) {
            revokeReplicaCapability(capability);
            throw error;
          }
          return {
            close: async () => {
              revokeReplicaCapability(capability);
              await context.close();
            },
            route: async (pattern, handler) => { await context.route(pattern, handler); },
            async newPage() {
              const page = await context.newPage();
              return {
                locator: selector => page.locator(selector),
                goto: async (url, options) => { await page.goto(url, options); },
                waitForEvent: (event, options) => page.waitForEvent(event, options),
                setDefaultTimeout: ms => page.setDefaultTimeout(ms),
              };
            },
          };
        },
      };
    },
  };
}