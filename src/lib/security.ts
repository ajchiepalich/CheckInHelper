import { UserRole } from "@prisma/client";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
}

export function requireRole(
  userRole: UserRole | undefined,
  allowed: UserRole[],
): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

export function sanitizeUserInput(input: string, maxLength = 4000): string {
  return input.trim().slice(0, maxLength);
}

export function isAllowedAtlassianUrl(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    return parsed.hostname === base.hostname;
  } catch {
    return false;
  }
}

export function verifyCronSecret(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  return token === secret;
}

export const CHAT_MAX_INPUT_LENGTH = 4000;
export const FEEDBACK_MAX_COMMENT_LENGTH = 2000;
