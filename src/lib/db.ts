import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getEnv } from "@/lib/env";

export const UserRole = { STAFF: "STAFF", ADMIN: "ADMIN" } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const SourceStatus = { PENDING: "PENDING", SYNCED: "SYNCED", UNCHANGED: "UNCHANGED", CHANGED: "CHANGED", FAILED: "FAILED", UNAVAILABLE: "UNAVAILABLE", DISABLED: "DISABLED" } as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];
export const SyncRunStatus = { PENDING: "PENDING", RUNNING: "RUNNING", COMPLETED: "COMPLETED", FAILED: "FAILED", CANCELLED: "CANCELLED" } as const;
export type SyncRunStatus = (typeof SyncRunStatus)[keyof typeof SyncRunStatus];
export const SyncTriggerType = { CRON: "CRON", MANUAL: "MANUAL", SINGLE_SOURCE: "SINGLE_SOURCE", RETRY: "RETRY" } as const;
export type SyncTriggerType = (typeof SyncTriggerType)[keyof typeof SyncTriggerType];
export const SyncItemStatus = { ADDED: "ADDED", UPDATED: "UPDATED", UNCHANGED: "UNCHANGED", REMOVED: "REMOVED", FAILED: "FAILED", SKIPPED: "SKIPPED" } as const;
export type SyncItemStatus = (typeof SyncItemStatus)[keyof typeof SyncItemStatus];
export const FeedbackHelpful = { HELPFUL: "HELPFUL", NOT_HELPFUL: "NOT_HELPFUL", INCORRECT: "INCORRECT" } as const;
export type FeedbackHelpful = (typeof FeedbackHelpful)[keyof typeof FeedbackHelpful];
export const AuditEventType = { SOURCE_CREATED: "SOURCE_CREATED", SOURCE_UPDATED: "SOURCE_UPDATED", SOURCE_DELETED: "SOURCE_DELETED", SOURCE_ENABLED: "SOURCE_ENABLED", SOURCE_DISABLED: "SOURCE_DISABLED", SYNC_TRIGGERED: "SYNC_TRIGGERED", SYNC_COMPLETED: "SYNC_COMPLETED", SYNC_FAILED: "SYNC_FAILED", USER_LOGIN: "USER_LOGIN" } as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

export type KnowledgeSource = {
  id: string; confluencePageId: string; sourceUrl: string; title: string; spaceId: string | null; spaceKey: string | null;
  sourceType: string; category: string | null; audience: string | null; classification: string | null; enabled: boolean;
  includeDescendants: boolean; labelName: string | null; lastKnownVersion: number | null; lastKnownUpdatedAt: string | null;
  contentHash: string | null; openaiFileId: string | null; lastSuccessfulSyncAt: string | null; lastAttemptedSyncAt: string | null;
  status: SourceStatus; lastError: string | null; createdAt: string; updatedAt: string;
};

let client: ReturnType<typeof createClient> | undefined;

/** Server-side database client. The service-role key never reaches the browser. */
// Database types can be generated from `supabase gen types` later. Keep this
// boundary untyped so PostgREST can operate against the existing quoted schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (!client) {
    const env = getEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function dbError(error: PostgrestError | null, action: string): never {
  throw new Error(`${action}: ${error?.message ?? "unknown database error"}`);
}

export function iso(value: Date | string | null | undefined): string | null | undefined {
  return value instanceof Date ? value.toISOString() : value;
}

/** IDs are generated here because the original Prisma tables use CUID defaults
 * in the client rather than PostgreSQL column defaults. */
export function createId(): string {
  return randomUUID();
}
