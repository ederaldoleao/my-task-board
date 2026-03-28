import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { z } from "zod";

const router = Router();
const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

const createTaskSchema = z.object({
  name: z.string().min(1).default("Nova tarefa"),
  description: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

// Cria board com 4 tarefas de exemplo e retorna apenas o id (usado pelo frontend).
async function createDefaultBoard() {
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
            priority: "HIGH",
            completed: false,
          },
          {
            name: "Task in Progress",
            description: "Currently working on this task.",
            icon: "🌙",
            status: "IN_PROGRESS",
            order: 1,
            priority: "MEDIUM",
            completed: false,
          },
          {
            name: "Task Completed",
            description: "This task has been finished.",
            icon: "✅",
            status: "COMPLETED",
            order: 2,
            priority: "LOW",
            completed: true,
          },
          {
            name: "Task Won't Do",
            description: "This task will not be done.",
            icon: "❌",
            status: "WONT_DO",
            order: 3,
            priority: "LOW",
            completed: false,
          },
        ],
      },
    },
    select: { id: true },
  });

  return board.id;
}

/**
 * POST /api/boards
 * Cria board + 4 tasks default (igual ao design)
 */
router.post("/", async (req, res, next) => {
  try {
    const id = await createDefaultBoard();
    res.status(201).json({ id });
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

    // Busca board; se não existir, cria um novo e devolve já com tasks.
    let board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        tasks: {
          orderBy: [
            { completed: "asc" },
            { priority: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!board) {
      const newId = await createDefaultBoard();
      res.setHeader("x-board-id", newId);

      board = await prisma.board.findUnique({
        where: { id: newId },
        include: {
          tasks: {
            orderBy: [
              { completed: "asc" },
              { priority: "asc" },
              { createdAt: "asc" },
            ],
          },
        },
      });

      return res.status(200).json(board);
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
    const body = createTaskSchema.parse(req.body ?? {});

    const last = await prisma.task.findFirst({
      where: { boardId, status: "TODO" },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const nextOrder = (last?.order ?? -1) + 1;

    const created = await prisma.task.create({
      data: {
        boardId,
        name: body.name,
        description: body.description ?? null,
        icon: "📝",
        status: "TODO",
        order: nextOrder,
        priority: body.priority,
        completed: false,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

export default router;
