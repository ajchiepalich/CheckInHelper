Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://highlands:highlands_dev@localhost:5432/highlands_docs",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "test-auth-secret-minimum-32-characters-long",
  LOCAL_AUTH_ENABLED: "true",
  LOCAL_MOCK_MODE: "true",
  APP_URL: "http://localhost:3000",
});
