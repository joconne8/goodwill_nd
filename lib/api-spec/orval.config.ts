import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  // Orval's Zod generator maps OpenAPI integers to z.number() by default.
  // Carry integer/safe-range semantics into both generated contract targets.
  const constrainIntegers = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(constrainIntegers);
      return;
    }
    const schema = value as Record<string, unknown>;
    if (schema.type === "integer" || (Array.isArray(schema.type) && schema.type.includes("integer"))) {
      schema.multipleOf ??= 1;
      schema.minimum ??= Number.MIN_SAFE_INTEGER;
      schema.maximum ??= Number.MAX_SAFE_INTEGER;
    }
    Object.values(schema).forEach(constrainIntegers);
  };
  constrainIntegers(config);

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      override: {
        // pnpm catalogs are not package-version literals; do not infer v4.
        query: { version: 5 },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      override: {
        zod: {
          // Preserve the installed classic Zod 3 API instead of auto-detection.
          version: 3,
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
