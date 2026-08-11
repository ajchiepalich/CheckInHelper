import { describe, expect, it } from "vitest";
import { stripSourceAttributionFromAnswer } from "@/lib/assistant/prompts";

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
