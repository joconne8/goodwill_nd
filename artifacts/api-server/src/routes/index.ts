import { Router, type IRouter } from "express";
import healthRouter from "./health";
import goodwillRouter from "./goodwill";

const router: IRouter = Router();

router.use(healthRouter);
router.use(goodwillRouter);

export default router;
