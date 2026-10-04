import { Router, type Request, type IRouter } from "express";
import { GetGoodwillAssistantToolsResponse } from "@workspace/api-zod";
import { GoodwillAssistantService } from "./service";
import { GoodwillOverviewService } from "./overview";
import { DataError } from "../data/types";
import { readOnlyToolDefinitions } from "./tools";

/** Standalone composition also requires the same injected operator authorizer.
 * Runtime mounts this behind its existing mandatory authorization middleware. */
export function createAssistantRouter(
  assistant: GoodwillAssistantService,
  overview: GoodwillOverviewService,
  authorize: (request: Request) => Promise<string | null>,
): IRouter {
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      if (!await authorize(req)) {
        res.status(401).json({ code: "OPERATOR_AUTH_REQUIRED", message: "Authorized operator sign-in is required.", retainedPrevious: true });
        return;
      }
      next();
    } catch {
      res.status(503).json({ code: "AUTH_UNAVAILABLE", message: "Operator authorization is unavailable.", retainedPrevious: true });
    }
  });
  router.get("/assistant/tools", (_req, res): void => {
    res.json(GetGoodwillAssistantToolsResponse.parse(readOnlyToolDefinitions));
  });
  router.post("/assistant/query", async (req, res): Promise<void> => {
    try { res.json(await assistant.ask(req.body)); }
    catch (e) {
      const error = e instanceof DataError ? e : new DataError("ASSISTANT_UNAVAILABLE", "Read-only assistant service is unavailable.", 503);
      res.status(error.status).json({ code: error.code, message: error.message, retainedPrevious: true });
    }
  });
  router.get("/system/overview", async (_req, res): Promise<void> => {
    try { res.json(await overview.get()); }
    catch {
      res.status(503).json({ code: "OVERVIEW_UNAVAILABLE", message: "PostgreSQL/source coverage could not be verified. No counts are fabricated.", retainedPrevious: true });
    }
  });
  return router;
}