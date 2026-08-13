import { useRef, type FormEvent } from "react";
import {
  Bold,
  ChevronDown,
  Eraser,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

const SIZES = [
  { value: "3", label: "Small" },
  { value: "4", label: "Normal" },
  { value: "5", label: "Large" },
  { value: "6", label: "Huge" },
];

const TEXT_COLORS = ["#17201C", "#176B4D", "#B4563F", "#2E8B6A", "#4A6B8A", "#B97A2B"];
const SWATCH = TEXT_COLORS[1];

function cmd(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-text-secondary transition-colors duration-micro hover:bg-surface-2 hover:text-text-primary"
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  initialHtml,
  onHtml,
}: {
  initialHtml: string;
  onHtml: (html: string) => void;
}) {
  const editRef = useRef<HTMLDivElement>(null);

  const toggleBlock = (tag: string) => {
    cmd("formatBlock", tag);
  };

  const addLink = () => {
    const url = window.prompt("Link URL (https://…)", "https://");
    if (url) cmd("createLink", url);
  };

  const pickColor = (e: FormEvent<HTMLInputElement>, command: "foreColor" | "hiliteColor") => {
    cmd(command, e.currentTarget.value);
  };

  const pickSize = (e: FormEvent<HTMLSelectElement>) => {
    cmd("fontSize", e.currentTarget.value);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface focus-within:border-brand-600">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-2 px-1.5 py-1">
        <ToolbarBtn title="Bold" onClick={() => cmd("bold")}>
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => cmd("italic")}>
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Underline" onClick={() => cmd("underline")}>
          <Underline size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Strikethrough" onClick={() => cmd("strikeThrough")}>
          <Strikethrough size={15} />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Heading 1" onClick={() => toggleBlock("H1")}>
          <Heading1 size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Heading 2" onClick={() => toggleBlock("H2")}>
          <Heading2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Bullet list" onClick={() => cmd("insertUnorderedList")}>
          <List size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Numbered list" onClick={() => cmd("insertOrderedList")}>
          <ListOrdered size={15} />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-border" />

        <div className="relative">
          <select
            aria-label="Text size"
            defaultValue="4"
            onMouseDown={(e) => e.preventDefault()}
            onChange={pickSize}
            className="h-8 cursor-pointer appearance-none rounded-md border border-border bg-surface pl-2.5 pr-6 text-xs transition-colors duration-micro hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>

        <label
          title="Text color"
          aria-label="Text color"
          onMouseDown={(e) => e.preventDefault()}
          className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 hover:bg-surface"
        >
          <span className="h-3 w-3 rounded-full border border-border" style={{ background: SWATCH }} />
          <input
            type="color"
            className="h-0 w-0 opacity-0"
            onInput={(e) => pickColor(e, "foreColor")}
          />
        </label>
        <label
          title="Highlight color"
          aria-label="Highlight color"
          onMouseDown={(e) => e.preventDefault()}
          className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 hover:bg-surface"
        >
          <span className="flex h-3 w-3 items-center justify-center rounded border border-border text-[8px] font-bold text-text-muted">
            A
          </span>
          <input
            type="color"
            className="h-0 w-0 opacity-0"
            onInput={(e) => pickColor(e, "hiliteColor")}
          />
        </label>

        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn title="Add link" onClick={addLink}>
          <Link2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Clear formatting" onClick={() => cmd("removeFormat")}>
          <Eraser size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Undo" onClick={() => cmd("undo")}>
          <Undo2 size={15} />
        </ToolbarBtn>
      </div>

      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        className="note-body min-h-40 p-3 text-sm focus:outline-none"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        onInput={() => {
          if (editRef.current) onHtml(editRef.current.innerHTML);
        }}
      />
    </div>
  );
}