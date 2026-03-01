import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

/**
 * POST /api/boards
 * Cria board + 4 tasks default (igual ao design)
 */
router.post("/", async (req, res, next) => {
  try {
    const board = await prisma.board.create({
      data: {
        name: "My Task Board",
        description: "Tasks to keep organised",
        tasks: {
          create: [
            {
              name: "Task To Do",
              description: "Work on a challenge and learn TypeScript.",
              icon: "📚",
              status: "TODO",
              order: 0,
            },
            {
              name: "Task in Progress",
              description: "Currently working on this task.",
              icon: "🌙",
              status: "IN_PROGRESS",
              order: 0,
            },
            {
              name: "Task Completed",
              description: "This task has been finished.",
              icon: "✅",
              status: "COMPLETED",
              order: 0,
            },
            {
              name: "Task Won't Do",
              description: "This task will not be done.",
              icon: "❌",
              status: "WONT_DO",
              order: 0,
            },
          ],
        },
      },
      select: { id: true },
    });

    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/boards/:boardId
 */
router.get("/:boardId", async (req, res, next) => {
  try {
    const { boardId } = req.params;

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        tasks: {
          orderBy: [
            { status: "asc" },
            { order: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    res.json(board);
  } catch (error) {
    next(error);
  }
});

export default router;