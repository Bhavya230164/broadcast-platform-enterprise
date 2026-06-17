import express from "express";
import {
  createTask, updateTask, deleteTask, getAllTasks,
  getMyTasks, updateMyTask, markTaskRead,
} from "../controllers/taskController.js";
import { protect, adminOnly, memberOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/", adminOnly, createTask);
router.get("/all", adminOnly, getAllTasks);
router.patch("/:id", adminOnly, updateTask);
router.delete("/:id", adminOnly, deleteTask);

// Member
router.get("/mine", memberOnly, getMyTasks);
router.patch("/:id/read", memberOnly, markTaskRead);
router.patch("/:id/update", memberOnly, updateMyTask);

export default router;
