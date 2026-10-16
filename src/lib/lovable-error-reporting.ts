// Application runtime error logger
export function reportAppError(error: unknown, _context: Record<string, unknown> = {}) {
  if (process.env["NODE_ENV"] !== "production") {
    console.error("[Runtime Error]", error);
  }
}
