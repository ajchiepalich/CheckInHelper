import { describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";

describe("environment validation", () => {
  it("allows local mock development configuration", async () => {
    resetEnvCacheForTests();
    Object.assign(process.env, {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
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
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
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
    const previousSupabaseUrl = process.env.SUPABASE_URL;
    const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousAuthSecret = process.env.AUTH_SECRET;

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.AUTH_SECRET;
    process.env.NEXT_PHASE = "phase-production-build";
    Object.assign(process.env, { NODE_ENV: "production" });

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).not.toThrow();

    if (previousPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = previousPhase;
    }
    if (previousSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = previousSupabaseUrl;
    }
    if (previousServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    }
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  });
});
