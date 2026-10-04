// Offline regression for the one cross-major, parent-scoped override.
// No credentials, cloud requests, model calls or database access.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const apiRequire = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const storageRequire = createRequire(apiRequire.resolve("@google-cloud/storage"));
const gaxiosRequire = createRequire(storageRequire.resolve("gaxios"));

test("storage's actual gaxios 6 resolves UUID 11 with CommonJS and intact buffer guards", () => {
  assert.equal(gaxiosRequire("gaxios/package.json").version, "6.7.1");
  assert.equal(gaxiosRequire("uuid/package.json").version, "11.1.1");
  const uuid = gaxiosRequire("uuid");
  assert.equal(uuid.validate(uuid.v4()), true);
  assert.throws(() => uuid.v5("x", uuid.v5.DNS, new Uint8Array(8), 4), RangeError);
});

test("storage's actual gaxios serializes multipart data using the overridden UUID v4", async () => {
  const { Gaxios } = storageRequire("gaxios");
  let observed = false;
  const client = new Gaxios();
  const response = await client.request({
    url: "https://example.invalid/offline-only",
    method: "POST",
    multipart: [{ headers: { "Content-Type": "text/plain" }, content: "synthetic-body" }],
    adapter: async options => {
      observed = true;
      const type = options.headers["Content-Type"];
      const boundary = type.split("boundary=")[1];
      assert.equal(gaxiosRequire("uuid").validate(boundary), true);
      let body = "";
      for await (const chunk of options.body) body += chunk.toString();
      assert.ok(body.includes("synthetic-body"));
      assert.ok(body.includes(boundary));
      return { status: 200, statusText: "OK", headers: {}, data: "offline-ok", config: options };
    },
  });
  assert.equal(observed, true);
  assert.equal(response.data, "offline-ok");
});