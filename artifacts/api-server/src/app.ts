import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { authorizeOperator, currentOperatorAccess } from "./goodwill/operatorAuth";
import { consumeReplicaCapability } from "./goodwill/replicaCapability";
import { approvedAppOrigin } from "./goodwill/replicaDestination";
import { framework } from "./goodwill/analytics/definitions";

const app: Express = express();

// Explicit artifact-prefixed API alias. Rewriting before routing preserves all
// existing Origin, Clerk and operator guards; this is not an authorization bypass.
app.use((req, _res, next) => {
  if(req.url.startsWith("/goodwill-analytics/api/"))
    req.url=req.url.replace(/^\/goodwill-analytics\/api\//,"/api/");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({
  credentials: true,
  origin: (origin, callback) => callback(null, !origin || origin === approvedAppOrigin),
}));
app.use(express.json({ limit: "350kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api/goodwill", (req, res, next) => {
  const origin = req.headers.origin;
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if ((origin && origin !== approvedAppOrigin) || (mutation && origin !== approvedAppOrigin)) {
    res.status(403).json({ code: "INVALID_ORIGIN", message: "Use this application's approved browser origin.", retainedPrevious: true });
    return;
  }
  next();
});
app.get("/api/goodwill/access", currentOperatorAccess);
// Static sponsor definitions only. No repository access or financial values.
app.get("/api/goodwill/v2/analytics/framework", (_req,res) => {
  res.json(framework.map(k=>({...k,reason:"Sign in with an approved operator account to evaluate this definition against published data."})));
});
// Retained legacy financial paths require the same named demo account.
// Internal replay permission is single-use and ONLY grants synthetic generation.
app.use("/api/goodwill", async (req, res, next) => {
  const generator = req.method === "POST" && req.path === "/report";
  if (generator && consumeReplicaCapability(req.headers["x-goodwill-replica-capability"])) {
    next(); return;
  }
  // The v2 runtime has its own mandatory guard; every retained v1 path is private.
  if (req.path.startsWith("/v2/")) { next(); return; }
  try {
    if (await authorizeOperator(req)) { next(); return; }
    res.status(401).json({ code: "OPERATOR_AUTH_REQUIRED", message: "The approved demo account is required.", retainedPrevious: true });
  } catch {
    res.status(503).json({ code: "AUTH_UNAVAILABLE", message: "Account approval verification is unavailable.", retainedPrevious: true });
  }
});
app.use("/api", router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (error as { status?: number }).status;
  res.status(status === 413 ? 413 : 400).json({
    code: status === 413 ? "REPORT_TOO_LARGE" : "INVALID_JSON",
    error: status === 413 ? "This foundation accepts synthetic reports up to 250 KB." : "Invalid JSON request.",
  });
});

export default app;
