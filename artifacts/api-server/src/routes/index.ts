import { Router, type IRouter } from "express";
import healthRouter from "./health";
import intentRouter from "./intent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(intentRouter);

export default router;
