import { createHash, randomUUID } from "crypto";

export function createTraceId(): string {
  return randomUUID();
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export type LogContext = {
  traceId?: string;
  userId?: string;
  conversationId?: string;
  syncRunId?: string;
  openaiRequestId?: string;
  latencyMs?: number;
  retrievalCount?: number;
  citationCount?: number;
  [key: string]: unknown;
};

export function logInfo(message: string, context: LogContext = {}): void {
  console.info(
    JSON.stringify({
      level: "info",
      message,
      ...context,
      ts: new Date().toISOString(),
    }),
  );
}

export function logWarn(message: string, context: LogContext = {}): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      ...context,
      ts: new Date().toISOString(),
    }),
  );
}

export function logError(
  message: string,
  error: unknown,
  context: LogContext = {},
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: String(error) };
  console.error(
    JSON.stringify({
      level: "error",
      message,
      error: err,
      ...context,
      ts: new Date().toISOString(),
    }),
  );
}

export function getDiagnosticsSummary(): Record<string, unknown> {
  return {
    nodeEnv: process.env.NODE_ENV,
    mockMode: process.env.LOCAL_MOCK_MODE === "true",
    localAuth: process.env.LOCAL_AUTH_ENABLED === "true",
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasVectorStore: Boolean(process.env.OPENAI_VECTOR_STORE_ID),
    hasConfluence: Boolean(process.env.ATLASSIAN_BASE_URL),
  };
}
