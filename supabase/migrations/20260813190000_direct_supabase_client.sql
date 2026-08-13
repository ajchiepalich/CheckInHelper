-- Required once when moving the existing Prisma-created schema to direct Supabase JS.
-- Apply in Supabase Dashboard → SQL Editor, or with `supabase db push`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Prisma generated CUIDs in application code. Direct PostgREST inserts need
-- database-generated IDs instead.
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Conversation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "MessageCitation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "KnowledgeSource" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "KnowledgeFile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SyncRun" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SyncItem" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AnswerFeedback" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AuditEvent" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- Columns present in the final application model but absent from the original
-- Prisma migration checked into this repository.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "retrievalDiagnostics" JSONB;
ALTER TABLE "MessageCitation" ADD COLUMN IF NOT EXISTS "confluenceVersion" INTEGER;
ALTER TABLE "MessageCitation" ADD COLUMN IF NOT EXISTS "snippet" TEXT;

-- Preserve Prisma's @updatedAt behavior for direct Supabase updates.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_updated_at ON "User";
CREATE TRIGGER set_user_updated_at BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_conversation_updated_at ON "Conversation";
CREATE TRIGGER set_conversation_updated_at BEFORE UPDATE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_knowledge_source_updated_at ON "KnowledgeSource";
CREATE TRIGGER set_knowledge_source_updated_at BEFORE UPDATE ON "KnowledgeSource"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_sync_lock_updated_at ON "SyncLock";
CREATE TRIGGER set_sync_lock_updated_at BEFORE UPDATE ON "SyncLock"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The server uses the service-role client. Explicitly keep these application
-- tables inaccessible to anonymous browser requests.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageCitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnswerFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncLock" ENABLE ROW LEVEL SECURITY;
