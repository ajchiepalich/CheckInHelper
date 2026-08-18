import { describe, expect, it } from "vitest";
import {
  appendSourceLinks,
  formatAssistantAnswer,
  normalizeParagraphSpacing,
  stripSourceAttributionFromAnswer,
} from "@/lib/assistant/prompts";

describe("stripSourceAttributionFromAnswer", () => {
  it("removes trailing source attribution sentences", () => {
    const answer =
      "The Greystone manager pin is 1701.\n\nThis information comes from the login information listing for campuses at Church of the Highlands.";

    expect(stripSourceAttributionFromAnswer(answer)).toBe(
      "The Greystone manager pin is 1701.",
    );
  });

  it("removes according-to closing sentences", () => {
    const answer =
      "Use the campus check-in account listed for your location.\n\nAccording to the approved Highlands documentation.";

    expect(stripSourceAttributionFromAnswer(answer)).toBe(
      "Use the campus check-in account listed for your location.",
    );
  });

  it("leaves factual answers unchanged", () => {
    const answer = "The Greystone manager pin is 1701.";

    expect(stripSourceAttributionFromAnswer(answer)).toBe(answer);
  });
});

describe("normalizeParagraphSpacing", () => {
  it("inserts blank lines between consecutive paragraphs", () => {
    const answer =
      "A confidential note is a private record.\nGuidelines for use include:";

    expect(normalizeParagraphSpacing(answer)).toBe(
      "A confidential note is a private record.\n\nGuidelines for use include:",
    );
  });
});

describe("appendSourceLinks", () => {
  it("appends markdown links for uncited sources", () => {
    const answer = "Use the campus check-in account listed for your location.";
    const formatted = appendSourceLinks(answer, [
      {
        title: "Login Information for Campuses",
        sourceUrl: "https://example.com/login",
      },
    ]);

    expect(formatted).toContain(
      "**Sources**\n\n- [Login Information for Campuses](https://example.com/login)",
    );
  });

  it("skips sources already linked inline", () => {
    const answer =
      "Use the campus account. [Login Information for Campuses](https://example.com/login)";
    const formatted = appendSourceLinks(answer, [
      {
        title: "Login Information for Campuses",
        sourceUrl: "https://example.com/login",
      },
    ]);

    expect(formatted).toBe(answer);
  });
});

describe("formatAssistantAnswer", () => {
  it("formats spacing and appends source links", () => {
    const answer =
      "A confidential note is private.\nGuidelines include using factual language.";
    const formatted = formatAssistantAnswer(answer, [
      {
        title: "Safety & Security Notes",
        sourceUrl: "https://example.com/security",
      },
    ]);

    expect(formatted).toContain("A confidential note is private.\n\nGuidelines");
    expect(formatted).toContain(
      "[Safety & Security Notes](https://example.com/security)",
    );
  });
});
