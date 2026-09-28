import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useLanguage } from "@/hooks/useLanguage";
import { ProtectedRoute } from "@/components/route-guards/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/route-guards/RoleProtectedRoute";
import { PhysioRoute } from "@/components/route-guards/PhysioRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const Coaches = lazy(() => import("./pages/Coaches"));
const CoachProfile = lazy(() => import("./pages/CoachProfile"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const Trainings = lazy(() => import("./pages/Trainings"));
const Matches = lazy(() => import("./pages/Matches"));
const TacticalBoard = lazy(() => import("./pages/TacticalBoard"));
const SeasonTransition = lazy(() => import("./pages/SeasonTransition"));
const SeasonsIndex = lazy(() => import("./pages/SeasonsIndex"));
const SeasonClosePage = lazy(() => import("./pages/SeasonClosePage"));
const SeasonCreatePage = lazy(() => import("./pages/SeasonCreatePage"));
const SeasonTransitionWizard = lazy(() => import("./pages/SeasonTransitionWizard"));
const Club = lazy(() => import("./pages/Club"));
const Finances = lazy(() => import("./pages/Finances"));
import NotFound from "./pages/NotFound";
const Settings = lazy(() => import("./pages/Settings"));
// ERP Pages
const ERPDashboard = lazy(() => import("./pages/erp/ERPDashboard"));
const ClubProfile = lazy(() => import("./pages/erp/ClubProfile"));
const Accounting = lazy(() => import("./pages/erp/Accounting"));
const Athletes = lazy(() => import("./pages/erp/Athletes"));
const BillingDashboard = lazy(() => import("./pages/erp/BillingDashboard"));
const PaymentsDashboard = lazy(() => import("./pages/erp/PaymentsDashboard"));
const BudgetDashboard = lazy(() => import("./pages/erp/BudgetDashboard"));
const ProcurementDashboard = lazy(() => import("./pages/erp/ProcurementDashboard"));
const WorkforceDashboard = lazy(() => import("./pages/erp/WorkforceDashboard"));
const InventoryDashboard = lazy(() => import("./pages/erp/InventoryDashboard"));
const FacilitiesDashboard = lazy(() => import("./pages/erp/FacilitiesDashboard"));
const MedicalDashboard = lazy(() => import("./pages/erp/MedicalDashboard"));
const AcademyDashboard = lazy(() => import("./pages/erp/AcademyDashboard"));
const ScoutingDashboard = lazy(() => import("./pages/erp/ScoutingDashboard"));
const MatchRulesDashboard = lazy(() => import("./pages/erp/MatchRulesDashboard"));
// Physio Pages
const PhysioDashboard = lazy(() => import("./pages/physio/PhysioDashboard"));
const InjuriesList = lazy(() => import("./pages/physio/InjuriesList"));
const InjuryForm = lazy(() => import("./pages/physio/InjuryForm"));
const RehabPlansList = lazy(() => import("./pages/physio/RehabPlansList"));
const RehabPlanForm = lazy(() => import("./pages/physio/RehabPlanForm"));
// Communication
const Communication = lazy(() => import("./pages/Communication"));
const GuardianPortal = lazy(() => import("./pages/GuardianPortal"));
const PlayerPortal = lazy(() => import("./pages/PlayerPortal"));
// Youth Coordination
const YouthCoordinationDashboard = lazy(() => import("./pages/coordination/YouthCoordinationDashboard"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const InviteTemplatesAdmin = lazy(() => import("./pages/InviteTemplatesAdmin"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const SeasonsPage = lazy(() => import("./pages/SeasonsPage"));
const SeasonCreateWizard = lazy(() => import("./pages/SeasonCreateWizard"));
import { SeasonProvider } from "@/hooks/useSeasonContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60,
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false;
        return failureCount < 3;
      },
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AppContent() {
  useLanguage();
  
  return (
    <>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <BrowserRouter>
        <SeasonProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/accept-invite/code" element={<AcceptInvite />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          
          
          {/* Protected routes - require authentication */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/teams" element={<RoleProtectedRoute><Teams /></RoleProtectedRoute>} />
          <Route path="/teams/:id" element={<RoleProtectedRoute><TeamDetail /></RoleProtectedRoute>} />
          <Route path="/coaches" element={<RoleProtectedRoute><Coaches /></RoleProtectedRoute>} />
          <Route path="/coach-profile" element={<RoleProtectedRoute><CoachProfile /></RoleProtectedRoute>} />
          <Route path="/players" element={<RoleProtectedRoute><Players /></RoleProtectedRoute>} />
          <Route path="/players/:id" element={<RoleProtectedRoute><PlayerDetail /></RoleProtectedRoute>} />
          <Route path="/matches" element={<RoleProtectedRoute><Matches /></RoleProtectedRoute>} />
          <Route path="/training" element={<RoleProtectedRoute><Trainings /></RoleProtectedRoute>} />
          <Route path="/tactical-board" element={<RoleProtectedRoute><TacticalBoard /></RoleProtectedRoute>} />
          <Route path="/season-transition" element={<RoleProtectedRoute><SeasonTransition /></RoleProtectedRoute>} />
          <Route path="/seasons" element={<RoleProtectedRoute><SeasonsPage /></RoleProtectedRoute>} />
          <Route path="/seasons/wizard" element={<RoleProtectedRoute><SeasonCreateWizard /></RoleProtectedRoute>} />
          <Route path="/seasons/list" element={<RoleProtectedRoute><SeasonsIndex /></RoleProtectedRoute>} />
          <Route path="/seasons/new" element={<RoleProtectedRoute><SeasonCreatePage /></RoleProtectedRoute>} />
          <Route path="/seasons/close" element={<RoleProtectedRoute><SeasonClosePage /></RoleProtectedRoute>} />
          <Route path="/seasons/transition" element={<RoleProtectedRoute><SeasonTransitionWizard /></RoleProtectedRoute>} />
          <Route path="/communication" element={<ProtectedRoute><Communication /></ProtectedRoute>} />
          <Route path="/guardian" element={<ProtectedRoute><GuardianPortal /></ProtectedRoute>} />
          <Route path="/player" element={<ProtectedRoute><PlayerPortal /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          
          
          {/* Club admin routes */}
          <Route path="/club" element={<RoleProtectedRoute requireClubOrCoach><Club /></RoleProtectedRoute>} />
          <Route path="/finances" element={<RoleProtectedRoute requireClubOrCoach><Finances /></RoleProtectedRoute>} />
          
          {/* ERP Routes - Club admin only */}
          <Route path="/erp" element={<RoleProtectedRoute requireClubAdmin><ERPDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/perfil" element={<RoleProtectedRoute requireClubAdmin><ClubProfile /></RoleProtectedRoute>} />
          <Route path="/erp/contabilidade" element={<RoleProtectedRoute requireClubAdmin><Accounting /></RoleProtectedRoute>} />
          <Route path="/erp/atletas" element={<RoleProtectedRoute requireClubAdmin><Athletes /></RoleProtectedRoute>} />
          <Route path="/erp/billing" element={<RoleProtectedRoute requireClubAdmin><BillingDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/payments" element={<RoleProtectedRoute requireClubAdmin><PaymentsDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/budget" element={<RoleProtectedRoute requireClubAdmin><BudgetDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/procurement" element={<RoleProtectedRoute requireClubAdmin><ProcurementDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/workforce" element={<RoleProtectedRoute requireClubAdmin><WorkforceDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/inventory" element={<RoleProtectedRoute requireClubAdmin><InventoryDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/facilities" element={<RoleProtectedRoute requireClubAdmin><FacilitiesDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/medical" element={<PhysioRoute><MedicalDashboard /></PhysioRoute>} />
          <Route path="/erp/academy" element={<RoleProtectedRoute requireClubAdmin><AcademyDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/scouting" element={<RoleProtectedRoute requireClubAdmin><ScoutingDashboard /></RoleProtectedRoute>} />
          <Route path="/erp/match-rules" element={<RoleProtectedRoute requireClubAdmin><MatchRulesDashboard /></RoleProtectedRoute>} />
          
          {/* Physio Routes - Physio/Admin access */}
          <Route path="/club/physio" element={<PhysioRoute><PhysioDashboard /></PhysioRoute>} />
          <Route path="/club/physio/injuries" element={<PhysioRoute><InjuriesList /></PhysioRoute>} />
          <Route path="/club/physio/injuries/:id" element={<PhysioRoute><InjuryForm /></PhysioRoute>} />
          <Route path="/club/physio/rehab" element={<PhysioRoute><RehabPlansList /></PhysioRoute>} />
          <Route path="/club/physio/rehab/:id" element={<PhysioRoute><RehabPlanForm /></PhysioRoute>} />
          
          {/* Youth Coordination */}
          <Route path="/club/coordination" element={<RoleProtectedRoute requireClubAdmin><YouthCoordinationDashboard /></RoleProtectedRoute>} />
          
          {/* Admin Templates */}
          <Route path="/admin/invite-templates" element={<RoleProtectedRoute requireClubOrCoach><InviteTemplatesAdmin /></RoleProtectedRoute>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </SeasonProvider>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
