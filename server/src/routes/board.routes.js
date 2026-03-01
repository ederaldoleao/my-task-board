import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { z } from "zod";

const router = Router();
const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

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

/**
 * PUT /api/boards/:boardId
 */
router.put("/:boardId", async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const body = updateBoardSchema.parse(req.body ?? {});

    const updated = await prisma.board.update({
      where: { id: boardId },
      data: body,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/boards/:boardId
 */
router.delete("/:boardId", async (req, res, next) => {
  try {
    const { boardId } = req.params;

    await prisma.board.delete({
      where: { id: boardId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/boards/:boardId/tasks
 */
router.post("/:boardId/tasks", async (req, res, next) => {
  try {
    const { boardId } = req.params;

    const last = await prisma.task.findFirst({
      where: { boardId, status: "TODO" },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const nextOrder = (last?.order ?? -1) + 1;

    const created = await prisma.task.create({
      data: {
        boardId,
        name: "New Task",
        description: null,
        icon: "📝",
        status: "TODO",
        order: nextOrder,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

export default router;