Object.assign(process.env, {
  NODE_ENV: "test",
  SUPABASE_URL: process.env.SUPABASE_URL ?? "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "test-auth-secret-minimum-32-characters-long",
  LOCAL_AUTH_ENABLED: "true",
  LOCAL_MOCK_MODE: "true",
  APP_URL: "http://localhost:3000",
});
