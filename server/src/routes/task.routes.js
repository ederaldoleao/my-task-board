import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const router = Router();

const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "WONT_DO"]);

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  status: TaskStatus.optional(),
  order: z.number().int().optional(),
});

/**
 * PUT /api/tasks/:taskId
 * Atualiza dados da task
 */
router.put("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const body = updateTaskSchema.parse(req.body ?? {});

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: body,
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