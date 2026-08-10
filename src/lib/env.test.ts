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
});
