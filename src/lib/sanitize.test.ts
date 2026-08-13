import { describe, expect, it } from "vitest";
import { noteExcerpt, sanitizeRichHtml } from "@/lib/sanitize";

describe("sanitizeRichHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeRichHtml("<p>safe</p><script>alert(1)</script>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
  });

  it("strips event-handler attributes from allowed tags", () => {
    const out = sanitizeRichHtml('<p onerror="alert(1)">hi</p>');
    expect(out).not.toContain("onerror");
    expect(out).toContain("hi");
  });

  it("neutralises javascript: hrefs and hardens links", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a><a href="https://example.com">y</a>');
    expect(out).toContain('href="#"');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener"');
    expect(out).toContain('target="_blank"');
  });

  it("unwraps unknown tags, keeping their cleaned children", () => {
    const out = sanitizeRichHtml("<div><custom>text</custom></div>");
    expect(out).toContain("text");
    expect(out).not.toContain("custom");
  });

  it("keeps formatting tags and style attributes", () => {
    const out = sanitizeRichHtml('<p><b style="color:red">bold</b></p>');
    expect(out).toContain("<b style=\"color:red\">");
    expect(out).toContain("bold");
  });

  it("removes hidden-dangerous attribute payloads from kept tags", () => {
    const out = sanitizeRichHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("img");
    expect(out).not.toContain("alert");
    expect(out).not.toContain("onerror");
  });

  it("returns empty for falsy input", () => {
    expect(sanitizeRichHtml("")).toBe("");
    expect(sanitizeRichHtml(null as unknown as string)).toBe("");
  });
});

describe("noteExcerpt", () => {
  it("returns plain text, whitespace-collapsed, capped at 140 chars", () => {
    const out = noteExcerpt("<p>Hello <b>world</b></p><p>plus&nbsp;nbsp</p>");
    expect(out.startsWith("Hello world plus nbsp")).toBe(true);
  });

  it("handles empty html", () => {
    expect(noteExcerpt("")).toBe("");
  });
});