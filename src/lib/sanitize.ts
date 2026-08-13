// --- HTML sanitizing for rich-text notes (write-time) ---
// Extracted here (pure DOM logic, no firebase import) so it's trivially
// unit-testable and reused by `src/lib/notes.ts`.

// Tags the editor can produce that we're willing to keep rendered.
const ALLOWED_TAGS = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "H1", "H2", "H3", "UL", "OL", "LI", "SPAN", "DIV",
  "FONT", "A", "BLOCKQUOTE", "PRE", "CODE",
]);
// Tags that carry risk of script execution / hiding content — dropped entirely.
const DANGEROUS_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "LINK", "META", "TITLE", "HEAD", "HTML", "BODY"]);
const ALLOWED_ATTRS = new Set(["style", "href", "target"]);

/** Strips everything but a safe, formatting-only subset of HTML. */
export function sanitizeRichHtml(html: string): string {
  if (typeof document === "undefined") return "";
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const clean = (node: Element) => {
    Array.from(node.children).forEach((child) => {
      if (DANGEROUS_TAGS.has(child.tagName)) {
        child.remove();
        return;
      }
      clean(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Unwrap unknown tags, keeping their (already-cleaned) children.
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") {
        const href = child.getAttribute("href") ?? "";
        if (!/^(https?:|mailto:|#|\/)/i.test(href)) child.setAttribute("href", "#");
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener");
      }
    });
  };

  clean(doc.body);
  return doc.body.innerHTML.replace(/\u00a0/g, " ").slice(0, 200_000);
}

/** Plain-text first ~140 chars of a note, for card previews. */
export function noteExcerpt(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  // textContent concatenates across block boundaries ("word" + "next" → "wordnext");
  // append a space after block-level elements so words don't run together.
  div.querySelectorAll("p, div, br, li, h1, h2, h3, blockquote, pre").forEach((el) => {
    el.append(" ");
  });
  return (div.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
}