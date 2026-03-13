import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, AdminRoute, RoleRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Assessments from "./pages/Assessments";
import Moderate from "./pages/Moderate";
import HistoryPage from "./pages/HistoryPage";
import Admin from "./pages/Admin";
import Supervision from "./pages/Supervision";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import AssessmentDetail from "./pages/AssessmentDetail";
import AdminAssessments from "./pages/AdminAssessments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/welcome" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<RoleRoute allowedRoles={["lecturer", "admin"]} fallback="/moderate"><Index /></RoleRoute>} />
              <Route path="/assessments" element={<RoleRoute allowedRoles={["lecturer", "admin"]} fallback="/moderate"><Assessments /></RoleRoute>} />
              <Route path="/moderate" element={<RoleRoute allowedRoles={["moderator", "admin"]}><Moderate /></RoleRoute>} />
              <Route path="/history" element={<RoleRoute allowedRoles={["moderator", "admin"]}><HistoryPage /></RoleRoute>} />
              <Route path="/assessment-detail" element={<RoleRoute allowedRoles={["lecturer", "admin"]}><AssessmentDetail /></RoleRoute>} />
              <Route path="/assessment-detail/:id" element={<RoleRoute allowedRoles={["lecturer", "admin"]}><AssessmentDetail /></RoleRoute>} />
              <Route path="/admin-assessments" element={<AdminRoute><AdminAssessments /></AdminRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/supervision" element={<AdminRoute><Supervision /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
