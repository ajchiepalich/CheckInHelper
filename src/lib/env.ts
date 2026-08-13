import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must be at least 32 characters"),
    LOCAL_AUTH_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    LOCAL_MOCK_MODE: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    ENTRA_CLIENT_ID: optionalString,
    ENTRA_CLIENT_SECRET: optionalString,
    ENTRA_TENANT_ID: optionalString,
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
    OPENAI_VECTOR_STORE_ID: optionalString,
    ATLASSIAN_BASE_URL: optionalString,
    CRON_SECRET: optionalString,
    CHAT_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    SYNC_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  })
  .superRefine((data, ctx) => {
    const isNextBuild = isNextBuildPhase();
    const enforceProduction = data.NODE_ENV === "production" && !isNextBuild;

    if (enforceProduction && data.LOCAL_AUTH_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LOCAL_AUTH_ENABLED must not be enabled in production.",
        path: ["LOCAL_AUTH_ENABLED"],
      });
    }

    if (enforceProduction && data.LOCAL_MOCK_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LOCAL_MOCK_MODE must not be enabled in production.",
        path: ["LOCAL_MOCK_MODE"],
      });
    }

    if (!data.LOCAL_MOCK_MODE && !isNextBuild) {
      if (!data.OPENAI_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "OPENAI_API_KEY is required when LOCAL_MOCK_MODE is disabled.",
          path: ["OPENAI_API_KEY"],
        });
      }
      if (!data.OPENAI_VECTOR_STORE_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "OPENAI_VECTOR_STORE_ID is required when LOCAL_MOCK_MODE is disabled.",
          path: ["OPENAI_VECTOR_STORE_ID"],
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

const BUILD_PLACEHOLDER_SUPABASE_URL = "https://build.supabase.co";
const BUILD_PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY =
  "build-time-placeholder-service-role-key";
const BUILD_PLACEHOLDER_AUTH_SECRET =
  "build-time-placeholder-secret-minimum-32-characters";

function isNextBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getEnvSource(): NodeJS.ProcessEnv {
  if (!isNextBuildPhase()) {
    return process.env;
  }

  return {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL ?? BUILD_PLACEHOLDER_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      BUILD_PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET ?? BUILD_PLACEHOLDER_AUTH_SECRET,
  };
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(getEnvSource());
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isLocalMockMode(): boolean {
  return getEnv().LOCAL_MOCK_MODE === true;
}

export function isLocalAuthEnabled(): boolean {
  return getEnv().LOCAL_AUTH_ENABLED === true;
}

export function isEntraConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET && env.ENTRA_TENANT_ID,
  );
}

export function isConfluenceConfigured(): boolean {
  return Boolean(getEnv().ATLASSIAN_BASE_URL);
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
