import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
app.use(express.json({ limit: "350kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (error as { status?: number }).status;
  res.status(status === 413 ? 413 : 400).json({
    code: status === 413 ? "REPORT_TOO_LARGE" : "INVALID_JSON",
    error: status === 413 ? "This foundation accepts synthetic reports up to 250 KB." : "Invalid JSON request.",
  });
});

export default app;
