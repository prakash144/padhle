import { describe, expect, it } from "vitest";
import { friendlyFirstName } from "./utils";

describe("friendlyFirstName", () => {
  it("capitalizes a lowercase first name", () => {
    expect(friendlyFirstName("prakash.rabidas2")).toBe("Prakash");
  });

  it("splits a full name on whitespace", () => {
    expect(friendlyFirstName("Prakash Rabidas")).toBe("Prakash");
    expect(friendlyFirstName("prakash rabidas")).toBe("Prakash");
  });

  it("keeps a single-word name", () => {
    expect(friendlyFirstName("Riya")).toBe("Riya");
  });

  it("falls back to 'there' when empty or null", () => {
    expect(friendlyFirstName("")).toBe("there");
    expect(friendlyFirstName("   ")).toBe("there");
    expect(friendlyFirstName(null)).toBe("there");
    expect(friendlyFirstName(undefined)).toBe("there");
  });
});
