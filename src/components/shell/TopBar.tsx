import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sun,
  User,
  UserRoundCog,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { signOutUser } from "@/lib/firebase";
import { useAcademicContext, ACADEMIC_CONTEXTS } from "@/lib/academicContext";
import { useTheme } from "@/lib/useTheme";
import { useToast } from "@/lib/useToast";
import { Dropdown } from "@/components/ui/dropdown";
import { Avatar } from "@/components/Avatar";
import { cn, friendlyFirstName } from "@/lib/utils";
import { useFeatures } from "@/lib/useFeatures";
import { useAdmin } from "@/lib/hooks";
import { NAV_GROUPS, navItemHidden } from "./SideNav";
import { daysBetween } from "@/lib/dates";

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { user, userDoc } = useAuth();
  const { selected, activeExam, switchContext, exams } = useAcademicContext();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const features = useFeatures();
  const isAdmin = useAdmin();
  const daysLeft = activeExam ? Math.max(0, daysBetween(new Date(), activeExam.examDate.toDate())) : null;

  const mobileMenuGroups = (isAdmin ? NAV_GROUPS : NAV_GROUPS.filter((g) => g.label !== "Admin"))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !navItemHidden(item, features)),
    }))
    .filter((group) => group.items.length > 0);

  // Only show the academic contexts the student actually picked in onboarding
  // (their examGoals). Fall back to the full catalog only when no goals exist
  // yet, and always keep the currently active context visible so the chip and
  // countdown never become orphaned.
  const examContexts = useMemo(() => {
    const selectedTypes = new Set(exams.map((e) => e.examType));
    if (selectedTypes.size === 0) return ACADEMIC_CONTEXTS;
    const list = ACADEMIC_CONTEXTS.filter((c) => selectedTypes.has(c.value));
    if (!list.some((c) => c.value === selected.value)) list.push(selected);
    return list;
  }, [exams, selected]);

  // Class-range picks (Class 1–5 / 6–8 / 9–10 / 11–12) collapse onto the
  // class10/class12 exam types, so prefer the exact onboarding label the
  // student chose over the generic "Class 10"/"Class 12" catalog label.
  const goalNames = useMemo(() => {
    const map = new Map<string, string>();
    exams.forEach((e) => map.set(e.examType, e.name));
    return map;
  }, [exams]);
  const labelFor = (value: typeof selected.value) => goalNames.get(value) ?? ACADEMIC_CONTEXTS.find((c) => c.value === value)?.label ?? selected.label;

  const canSwitch = examContexts.length > 1;

  const handleContextChange = async (value: typeof selected.value, close: () => void) => {
    close();
    if (value === selected.value) return;
    try {
      await switchContext(value);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't switch academic context. Try again.");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-border bg-surface/90 px-3 py-2 backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link to="/" aria-label="Padhle Today" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground" aria-hidden>
            प
          </span>
          <span className="hidden font-display text-lg font-bold text-text-primary min-[430px]:block">Padhle <span aria-hidden>🌳</span></span>
        </Link>

        <Dropdown
          align="start"
          panelClassName="w-52"
          trigger={({ open, toggle }) => (
            <button
              onClick={canSwitch ? toggle : undefined}
              aria-expanded={canSwitch ? open : undefined}
              aria-label={`Academic context: ${selected.label}`}
              title={canSwitch ? "Switch academic context" : undefined}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-2 text-xs font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:gap-2 sm:px-3 sm:text-sm"
            >
              <BookOpen size={15} className="hidden shrink-0 text-brand-600 min-[420px]:block" />
              <span className="max-w-20 truncate sm:max-w-none">{labelFor(selected.value)}</span>
              {canSwitch && (
                <ChevronDown size={14} className={cn("shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              {(["Boards", "Competitive"] as const).map((group) => {
                const contexts = examContexts.filter((item) => item.group === group);
                if (contexts.length === 0) return null;
                return (
                  <div key={group} className="py-1">
                    <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">{group}</p>
                    {contexts.map((context) => (
                      <button
                        key={context.value}
                        onClick={() => handleContextChange(context.value, close)}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        <span>{labelFor(context.value)}</span>
                        {context.value === selected.value && <Check size={15} className="shrink-0 text-brand-600" />}
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </Dropdown>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button onClick={onOpenPalette} aria-label="Search or run a command" title="Search (Command K)" className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary md:flex">
          <Search size={15} />
          <span>Search</span>
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium">Cmd K</kbd>
        </button>
        <button onClick={onOpenPalette} aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:hidden">
          <Search size={16} />
        </button>
        <Dropdown align="end" panelClassName="w-64 max-h-[calc(100dvh-5rem)] overflow-y-auto" trigger={({ open, toggle }) => (
          <button onClick={toggle} aria-expanded={open} aria-label="Open menu" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:hidden">
            <Menu size={16} />
          </button>
        )}>
          {(close) => (
            <>
              {mobileMenuGroups.map((group) => (
                <div key={group.label} className="py-1">
                  <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">{group.label}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.to} to={item.to} onClick={close} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary">
                        <Icon size={16} /> {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </Dropdown>
        <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Dropdown panelClassName="w-60" trigger={({ open, toggle }) => (
          <button onClick={toggle} aria-expanded={open} aria-label="Open profile menu" className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-1.5 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-2 sm:pr-2.5">
            <Avatar src={userDoc?.photoURL ?? user?.photoURL} name={userDoc?.displayName} className="h-6 w-6 border-0 text-[11px]" />
            <span className="hidden max-w-24 truncate sm:block">{friendlyFirstName(userDoc?.displayName)}</span>
            <ChevronDown size={14} className={cn("hidden text-text-muted sm:block", open && "rotate-180")} />
          </button>
        )}>
          {(close) => (
            <>
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar src={userDoc?.photoURL ?? user?.photoURL} name={userDoc?.displayName} className="h-9 w-9 text-sm" />
                  <p className="truncate text-sm font-semibold text-text-primary">{friendlyFirstName(userDoc?.displayName)}</p>
                </div>
                <p className="mt-2 truncate text-xs text-text-muted">{labelFor(selected.value)}{daysLeft !== null ? ` · ${daysLeft} days left` : ""}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <ProfileLink to="/profile" icon={User} label="Profile" close={close} />
              <ProfileLink to="/profile" section="academic" icon={UserRoundCog} label="Academic setup" close={close} />
              <ProfileLink to="/profile" section="preferences" icon={Settings} label="Preferences" close={close} />
              <ProfileLink to="/profile" section="parents" icon={Share2} label="Parent / mentor share" close={close} />
              <ProfileLink to="/help" icon={HelpCircle} label="How to use" close={close} />
              <ProfileLink to="/profile" section="settings" icon={RotateCcw} label="Reset & re-onboard" close={close} />
              <div className="my-1 h-px bg-border" />
              <button onClick={() => signOutUser()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary">
                <LogOut size={16} /> Sign out
              </button>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}

function ProfileLink({
  to,
  section,
  icon: Icon,
  label,
  close,
}: {
  to: string;
  section?: string;
  icon: typeof User;
  label: string;
  close: () => void;
}) {
  const href = section ? `${to}?section=${section}` : to;
  return (
    <Link
      to={href}
      onClick={close}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}
