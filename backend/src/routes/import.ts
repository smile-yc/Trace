import { Router } from "express";
import { z } from "zod";
import {
  confirmWorkloadStandardImport,
  previewWorkloadStandardImport,
  type WorkloadStandardImportRow
} from "../database.js";
import { parseWorkloadStandardWorkbook } from "../core/workloadStandardImport.js";

const importRowSchema = z.object({
  businessCategory: z.string(),
  workType: z.string(),
  productSystem: z.string().optional(),
  subtask: z.string().optional(),
  unit: z.string().optional(),
  coefficient: z.coerce.number(),
  remark: z.string().optional()
});

const confirmSchema = z.object({
  name: z.string().trim().min(1).max(120),
  year: z.coerce.number().int().min(2000).max(2200).nullable().optional(),
  sourceName: z.string().trim().max(200).optional(),
  rows: z.array(importRowSchema).min(1).max(5000),
  conflictResolutions: z.record(z.enum(["keep_system", "use_imported"])).optional()
});

export function createImportRouter(): Router {
  const router = Router();

  router.post("/workload-standards/preview", async (req, res, next) => {
    try {
      const workbookBase64 = z.string().min(1).parse(req.body?.workbookBase64);
      const rows = await parseWorkloadStandardWorkbook(Buffer.from(workbookBase64, "base64"));
      res.json({ preview: previewWorkloadStandardImport(rows) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/workload-standards/confirm", (req, res, next) => {
    try {
      const input = confirmSchema.parse(req.body);
      const version = confirmWorkloadStandardImport({
        ...input,
        rows: input.rows as WorkloadStandardImportRow[]
      });
      res.status(201).json({ version });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
