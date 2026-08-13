import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { ArrowLeft, Moon, Sun, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoginBackdrop } from "@/components/LoginBackdrop";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from "@/lib/firebase";
import { useTheme } from "@/lib/useTheme";

type Mode = "signin" | "signup" | "forgot";

export function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await resetPassword(email);
        setInfo(`We've sent a password reset link to ${email} — check your inbox.`);
      }
      if (mode !== "forgot") navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err, mode === "forgot"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <LoginBackdrop />

      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute right-4 top-4 z-10 rounded-full bg-surface/70 p-2.5 text-text-secondary shadow-e2 backdrop-blur-md transition-colors hover:bg-surface hover:text-text-primary"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="rounded-2xl border border-border/60 bg-surface/70 p-6 shadow-e3 backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <TreePine size={28} strokeWidth={1.75} />
            </span>
            <h1 className="font-display text-2xl font-bold" lang="hi">पdhle</h1>
            <p className="text-sm text-text-secondary">Study smarter. Every day.</p>
          </div>

          <Button onClick={handleGoogle} disabled={busy} className="w-full" variant="secondary">
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {mode === "forgot" && (
                <p className="mt-2 text-xs text-text-muted">
                  Enter the email you signed up with — we'll send you a reset link.
                </p>
              )}
            </div>
            {mode !== "forgot" && (
              <Input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("forgot");
                }}
                className="text-xs font-medium text-text-secondary underline-offset-2 hover:text-brand-600 hover:underline"
              >
                Forgot password?
              </button>
            )}
            {info && <p className="text-sm text-success">{info}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          <button
            className="mt-4 flex w-full items-center justify-center gap-1 text-center text-sm text-text-secondary hover:text-text-primary"
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode((m) => (m === "signin" ? "signup" : "signin"));
            }}
          >
            {mode === "signin" && <ArrowLeft size={14} className="opacity-0" />}
            {mode === "forgot" && <ArrowLeft size={14} />}
            {mode === "signin"
              ? "New here? Create an account"
              : mode === "forgot"
                ? "Back to sign in"
                : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function friendlyError(err: unknown, isForgot = false): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return isForgot
          ? "We couldn't find an account for that email."
          : "That email/password doesn't match our records.";
      case "auth/email-already-in-use":
        return "An account already exists with that email.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/missing-email":
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Sign-in was cancelled.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
