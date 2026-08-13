import { lazy, Suspense, type ReactNode } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/lib/useToast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoSeed } from "@/components/DemoSeed";
import { AppShell } from "@/components/shell/AppShell";
import { Login } from "@/pages/Login";
import { Onboarding } from "@/pages/onboarding/Onboarding";
import { Today } from "@/pages/Today";

// Everything except the landing flows and the home page is code-split on
// demand, so the first paint only pays for Today (see AppShell). Charts,
// three.js and admin dashboards are further kept out of these chunks — the
// ones below live on the secondary chunk boundary.
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Planner = lazy(() => import("@/pages/Planner").then((m) => ({ default: m.Planner })));
const Syllabus = lazy(() => import("@/pages/Syllabus").then((m) => ({ default: m.Syllabus })));
const Forest = lazy(() => import("@/pages/Forest").then((m) => ({ default: m.Forest })));
const Focus = lazy(() => import("@/pages/Focus").then((m) => ({ default: m.Focus })));
const Sprints = lazy(() => import("@/pages/Sprints").then((m) => ({ default: m.Sprints })));
const SprintDetail = lazy(() => import("@/pages/SprintDetail").then((m) => ({ default: m.SprintDetail })));
const Errors = lazy(() => import("@/pages/Errors").then((m) => ({ default: m.Errors })));
const Profile = lazy(() => import("@/pages/Profile").then((m) => ({ default: m.Profile })));
const Backlog = lazy(() => import("@/pages/Backlog").then((m) => ({ default: m.Backlog })));
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const WeeklyReview = lazy(() => import("@/pages/WeeklyReview").then((m) => ({ default: m.WeeklyReview })));
const Parent = lazy(() => import("@/pages/Parent").then((m) => ({ default: m.Parent })));
const ParentHome = lazy(() => import("@/pages/ParentHome").then((m) => ({ default: m.ParentHome })));
const Notes = lazy(() => import("@/pages/Notes").then((m) => ({ default: m.Notes })));
const HowToUse = lazy(() => import("@/pages/HowToUse").then((m) => ({ default: m.HowToUse })));
// Charts + admin dashboards are heavy; code-split them out (see the >500 kB
// chunk warning) and load on demand.
const Analytics = lazy(() => import("@/pages/Analytics").then((m) => ({ default: m.Analytics })));
const Admin = lazy(() => import("@/pages/Admin").then((m) => ({ default: m.Admin })));
// Tests renders the recharts trend chart (MockTrendChart), so split it too to
// keep recharts out of the first paint.
const Tests = lazy(() => import("@/pages/Tests").then((m) => ({ default: m.Tests })));

function PageFallback() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-text-secondary">
      <span className="h-8 w-8 animate-pulse-soft rounded-full bg-primary" aria-hidden />
      <span className="animate-pulse-soft text-text-muted" aria-busy="true">
        Loading…
      </span>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <AuthProvider>
          <ToastProvider>
            <DemoSeed />
            <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/onboarding" element={<Onboarding />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/parent" element={<LazyPage><ParentHome /></LazyPage>} />
                  <Route path="/parent/:uid" element={<LazyPage><Parent /></LazyPage>} />
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Today />} />
                    <Route path="/dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
                    <Route path="/planner" element={<LazyPage><Planner /></LazyPage>} />
                    <Route path="/sprints" element={<LazyPage><Sprints /></LazyPage>} />
                    <Route path="/sprints/:sprintId" element={<LazyPage><SprintDetail /></LazyPage>} />
                    <Route path="/focus" element={<LazyPage><Focus /></LazyPage>} />
                    <Route path="/syllabus" element={<LazyPage><Syllabus /></LazyPage>} />
                    <Route path="/forest" element={<LazyPage><Forest /></LazyPage>} />
                    <Route path="/tests" element={<LazyPage><Tests /></LazyPage>} />
                    <Route path="/reports" element={<LazyPage><Reports /></LazyPage>} />
                    <Route path="/review" element={<LazyPage><WeeklyReview /></LazyPage>} />
                    <Route path="/errors" element={<LazyPage><Errors /></LazyPage>} />
                    <Route path="/backlog" element={<LazyPage><Backlog /></LazyPage>} />
                    <Route path="/profile" element={<LazyPage><Profile /></LazyPage>} />
                    <Route path="/notes" element={<LazyPage><Notes /></LazyPage>} />
                    <Route path="/help" element={<LazyPage><HowToUse /></LazyPage>} />
                    <Route path="/analytics" element={<LazyPage><Analytics /></LazyPage>} />
                    <Route path="/admin" element={<LazyPage><Admin /></LazyPage>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </HashRouter>
          </ToastProvider>
        </AuthProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
