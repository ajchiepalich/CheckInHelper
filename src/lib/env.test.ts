import { describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";

describe("environment validation", () => {
  it("allows local mock development configuration", async () => {
    resetEnvCacheForTests();
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://localhost:5432/test",
      AUTH_SECRET: "test-auth-secret-minimum-32-characters-long",
      LOCAL_AUTH_ENABLED: "true",
      LOCAL_MOCK_MODE: "true",
      NODE_ENV: "development",
    });

    const { getEnv } = await import("@/lib/env");
    const env = getEnv();
    expect(env.LOCAL_MOCK_MODE).toBe(true);
    expect(env.LOCAL_AUTH_ENABLED).toBe(true);
  });

  it("rejects production mock mode", async () => {
    resetEnvCacheForTests();
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://localhost:5432/test",
      AUTH_SECRET: "test-auth-secret-minimum-32-characters-long",
      LOCAL_MOCK_MODE: "true",
      NODE_ENV: "production",
      OPENAI_API_KEY: "test-key",
      OPENAI_VECTOR_STORE_ID: "vs_test",
    });

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/LOCAL_MOCK_MODE/);
  });

  it("allows missing core secrets during Next.js production build", async () => {
    resetEnvCacheForTests();
    const previousPhase = process.env.NEXT_PHASE;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousAuthSecret = process.env.AUTH_SECRET;

    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.NODE_ENV = "production";

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).not.toThrow();

    if (previousPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = previousPhase;
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  });
});
