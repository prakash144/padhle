import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import { BookOpen, Check, ClipboardList, Pin, PlayCircle, Plus, RotateCcw, Save, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  NOTE_COLORS,
  createNote,
  deleteNote,
  noteExcerpt,
  timeAgo,
  toggleNotePin,
  updateNote,
} from "@/lib/notes";
import { useTags, addTag, deleteTag } from "@/lib/tags";
import { createTask } from "@/lib/tasks";
import { dayKey } from "@/lib/dates";
import { useChapters, useSubjects } from "@/lib/hooks";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import type { NoteDoc } from "@/lib/schema";
import { filterChaptersByContext, filterSubjectsByContext, useAcademicContext } from "@/lib/academicContext";

export function Notes() {
  const { user } = useAuth();
  const tags = useTags();
  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const { selected: academicContext } = useAcademicContext();
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, academicContext.value), [allSubjects, academicContext.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, academicContext.value), [allChapters, academicContext.value]);
  const [notes, setNotes] = useState<(NoteDoc & { id: string })[]>([]);
  const [openId, setOpenId] = useState<string | null | "new">(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [color, setColor] = useState<string>(NOTE_COLORS[0]);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(24);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notes"),
      orderBy("updatedAt", "desc"),
      limit(visible)
    );
    return onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as NoteDoc) })));
    });
  }, [user, visible]);

  useEffect(() => {
    setVisible(24);
  }, [search, activeTag]);

  const sorted = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const bt = b.updatedAt?.toDate?.().getTime() ?? 0;
        const at = a.updatedAt?.toDate?.().getTime() ?? 0;
        return bt - at;
      }),
    [notes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((n) => {
      if (activeTag && !(n.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        noteExcerpt(n.html).toLowerCase().includes(q) ||
        (n.subjectName ?? "").toLowerCase().includes(q) ||
        (n.chapterName ?? "").toLowerCase().includes(q)
      );
    });
  }, [sorted, search, activeTag]);

  const chapterOptions = useMemo(
    () => chapters.filter((chapter) => chapter.subjectId === subjectId),
    [chapters, subjectId]
  );

  const openNote = (note: (NoteDoc & { id: string }) | undefined) => {
    setTitle(note?.title ?? "");
    setHtml(note?.html ?? "");
    setColor(note?.color ?? NOTE_COLORS[0]);
    setNoteTags(note?.tags ?? []);
    setSubjectId(note?.subjectId ?? "");
    setChapterId(note?.chapterId ?? "");
    setOpenId(note ? note.id : "new");
  };

  const save = async () => {
    if (!user || (!title.trim() && !html.trim())) return;
    const subject = subjects.find((item) => item.id === subjectId);
    const chapter = chapters.find((item) => item.id === chapterId);
    const linked = {
      subjectId,
      subjectName: subject?.name ?? "",
      chapterId,
      chapterName: chapter?.name ?? "",
    };
    setSaving(true);
    try {
      if (openId === "new") {
        await createNote(user.uid, { title, html, color, tags: noteTags, ...linked });
      } else if (openId) {
        await updateNote(user.uid, openId, { title, html, color, tags: noteTags, ...linked });
      }
      setOpenId(null);
    } catch {
      toast.error("Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const addRevisionTask = async () => {
    if (!user || !chapterId) return;
    const subject = subjects.find((item) => item.id === subjectId);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) return;
    try {
      await createTask(user.uid, {
        title: `Revise ${chapter.name}`,
        category: "revision",
        subjectId: subject?.id ?? chapter.subjectId,
        subjectName: subject?.name ?? chapter.subjectName,
        chapterId: chapter.id,
        chapterName: chapter.name,
        priority: "med",
        difficulty: "easy",
        estimatedMinutes: 25,
        scheduledDate: dayKey(new Date()),
      });
      toast.success("Revision added to today's plan.");
    } catch {
      toast.error("Couldn't add the revision task.");
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    try {
      await deleteNote(user.uid, id);
      if (openId === id) setOpenId(null);
    } catch {
      toast.error("Couldn't delete the note.");
    }
  };

  const handleAddTag = async () => {
    if (!user || !newTagName.trim()) return;
    setAddingTag(true);
    try {
      await addTag(user.uid, newTagName);
      setNewTagName("");
    } catch {
      toast.error("Couldn't add the tag.");
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!user) return;
    setDeletingTagId(id);
    try {
      await deleteTag(user.uid, id);
      setNoteTags((prev) => prev.filter((t) => t !== id));
      if (activeTag === id) setActiveTag(null);
    } catch {
      toast.error("Couldn't delete the tag.");
    } finally {
      setDeletingTagId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">Notes</h1>
        <Button size="sm" onClick={() => openNote(undefined)}>
          <Plus size={16} /> New note
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes by title or text…"
          aria-label="Search notes"
          className="max-w-sm"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag size={14} className="text-text-muted" aria-hidden />
            <button
              onClick={() => setActiveTag(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-micro",
                activeTag === null
                  ? "border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-500"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong"
              )}
            >
              All
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTag(activeTag === t.id ? null : t.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-micro",
                  activeTag === t.id
                    ? "border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-500"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface py-14 text-center">
          <p className="text-2xl font-semibold">📝</p>
          <p className="mt-2 text-sm text-text-secondary">
            {search.trim()
              ? "No notes match your search."
              : "Take formatted study notes — formulas, mistakes, quick ideas."}
          </p>
          {!search.trim() && (
            <Button size="sm" className="mt-4" onClick={() => openNote(undefined)}>
              Write your first note
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, visible).map((note) => (
              <button
                key={note.id}
                onClick={() => openNote(note)}
                className="group rounded-xl border border-border bg-surface p-4 text-left transition-colors duration-micro hover:border-brand-600"
              >
                <div className="mb-2 h-1 w-10 rounded-full" style={{ background: note.color }} />
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-display font-semibold">{note.title}</p>
                  {note.pinned && <Pin size={14} className="shrink-0 text-brand-600" />}
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                  {noteExcerpt(note.html)}
                </p>
                {note.tags && note.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                        >
                          {tag.name}
                        </span>
                      ) : null;
                    })}
                    {note.tags.length > 3 && (
                      <span className="text-[10px] text-text-muted">+{note.tags.length - 3}</span>
                    )}
                  </div>
                )}
                {(note.subjectName || note.chapterName) && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-text-muted">
                    <BookOpen size={12} />
                    <span className="truncate">{note.chapterName ?? note.subjectName}</span>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-text-muted">{timeAgo(note.updatedAt)}</p>
              </button>
            ))}
          </div>
          {visible < filtered.length && (
            <div className="text-center">
              <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + 24)}>
                Show more notes ({filtered.length - visible} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {openId !== null && (
        <Dialog open={true} onOpenChange={(open) => !open && setOpenId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogTitle className="sr-only">Edit note</DialogTitle>
            <div className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                className="font-display text-base"
              />

              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`Note color ${c}`}
                    aria-pressed={color === c}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border border-black/10 transition-all duration-micro",
                      "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      color === c && "scale-110 ring-2 ring-brand-600 ring-offset-2 ring-offset-bg"
                    )}
                    style={{ background: c }}
                  >
                    {color === c && <Check size={12} strokeWidth={3} className="text-white" />}
                  </button>
                ))}
                {openId !== "new" && (
                  <button
                    onClick={() => toggleNotePin(user.uid, openId as string, !notes.find((n) => n.id === openId)?.pinned)}
                    className="ml-auto rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-primary"
                    aria-label="Pin note"
                  >
                    <Pin size={16} />
                  </button>
                )}
              </div>

              <RichTextEditor initialHtml={html} onHtml={setHtml} key={openId} />

              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <BookOpen size={13} /> Syllabus link
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select
                    value={subjectId || "__none"}
                    onChange={(value) => {
                      const next = value === "__none" ? "" : value;
                      setSubjectId(next);
                      setChapterId("");
                    }}
                    options={[
                      { value: "__none", label: "No subject" },
                      ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
                    ]}
                    aria-label="Link note to subject"
                  />
                  <Select
                    value={chapterId || "__none"}
                    onChange={(value) => setChapterId(value === "__none" ? "" : value)}
                    disabled={!subjectId}
                    options={[
                      { value: "__none", label: subjectId ? "No chapter" : "Choose subject first" },
                      ...chapterOptions.map((chapter) => ({ value: chapter.id, label: chapter.name })),
                    ]}
                    aria-label="Link note to chapter"
                  />
                </div>
                {(subjectId || chapterId) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/focus?subjectId=${subjectId}&chapterId=${chapterId}&activity=revision&target=25`}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-primary transition-all duration-standard hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[.98]"
                    >
                      <PlayCircle size={14} /> Start Focus
                    </Link>
                    <Link
                      to="/tests"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text-primary transition-all duration-standard hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[.98]"
                    >
                      <ClipboardList size={14} /> Practice
                    </Link>
                    <Button size="sm" variant="secondary" disabled={!chapterId} onClick={() => void addRevisionTask()}>
                      <RotateCcw size={14} /> Add Revision
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Tag size={13} /> Tags
                </div>
                {tags.length === 0 ? (
                  <p className="text-xs text-text-muted">No tags yet — add your first below.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => {
                      const active = noteTags.includes(t.id);
                      return (
                        <span key={t.id} className="flex items-center gap-0.5">
                          <button
                            onClick={() =>
                              setNoteTags((prev) =>
                                active ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                              )
                            }
                            aria-pressed={active}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-micro",
                              active
                                ? "border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-500"
                                : "border-border bg-surface text-text-secondary hover:border-border-strong"
                            )}
                          >
                            {t.name}
                          </button>
                          <button
                            onClick={() => void handleDeleteTag(t.id)}
                            disabled={deletingTagId === t.id}
                            aria-label={`Delete tag ${t.name}`}
                            className="rounded-full p-0.5 text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddTag();
                    }}
                    placeholder="New tag…"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2.5"
                    disabled={addingTag || !newTagName.trim()}
                    onClick={() => void handleAddTag()}
                  >
                    <Plus size={13} /> Add
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-2">
                {openId !== "new" ? (
                  <Button
                    variant="secondary"
                    onClick={() => remove(openId as string)}
                    disabled={saving}
                  >
                    <Trash2 size={15} /> Delete
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={save} disabled={saving}>
                  <Save size={15} /> Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
