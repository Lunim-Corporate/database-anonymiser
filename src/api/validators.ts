import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema): RequestHandler {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.validated = validated;
      next();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid request" });
    }
  };
}
