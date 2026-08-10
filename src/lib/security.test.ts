import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/security";
import { UserRole } from "@prisma/client";
import { NO_SOURCE_FALLBACK } from "@/lib/assistant/prompts";

describe("authorization", () => {
  it("allows configured roles", () => {
    expect(requireRole(UserRole.ADMIN, [UserRole.ADMIN])).toBe(true);
    expect(requireRole(UserRole.STAFF, [UserRole.ADMIN])).toBe(false);
    expect(requireRole(undefined, [UserRole.ADMIN])).toBe(false);
  });
});

describe("assistant fallback", () => {
  it("uses approved documentation fallback language", () => {
    expect(NO_SOURCE_FALLBACK).toContain("approved Highlands documentation");
  });
});
