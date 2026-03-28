import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const router = Router();

const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "WONT_DO"]);
const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  status: TaskStatus.optional(),
  order: z.number().int().optional(),
  priority: TaskPriority.optional(),
  completed: z.boolean().optional(),
});

/**
 * GET /api/tasks
 * Lista tarefas, opcionalmente filtrando por boardId
 */
router.get("/", async (req, res, next) => {
  try {
    const { boardId } = req.query;

    const tasks = await prisma.task.findMany({
      where: boardId ? { boardId: String(boardId) } : undefined,
      orderBy: [
        { completed: "asc" },
        { priority: "asc" },
        { createdAt: "desc" },
      ],
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/tasks/:taskId
 * Atualiza dados da task
 */
router.put("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const body = updateTaskSchema.parse(req.body ?? {});

    const data = { ...body };

    // Mantém status e completed sincronizados, independente do payload recebido.
    if (body.completed !== undefined) {
      data.status = body.completed ? "COMPLETED" : "TODO";
    }

    if (body.status) {
      data.completed = body.status === "COMPLETED";
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tasks/:taskId
 */
router.delete("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;

    await prisma.task.delete({ where: { id: taskId } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
