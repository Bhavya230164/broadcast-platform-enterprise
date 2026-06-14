import express from "express";
import { getCallHistory } from "../controllers/callHistoryController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getCallHistory);

export default router;