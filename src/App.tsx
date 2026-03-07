import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, AdminRoute, RoleRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Assessments from "./pages/Assessments";
import Moderate from "./pages/Moderate";
import HistoryPage from "./pages/HistoryPage";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

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
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<RoleRoute allowedRoles={["lecturer", "admin"]} fallback="/moderate"><Index /></RoleRoute>} />
              <Route path="/assessments" element={<RoleRoute allowedRoles={["lecturer", "admin"]} fallback="/moderate"><Assessments /></RoleRoute>} />
              <Route path="/moderate" element={<RoleRoute allowedRoles={["moderator", "admin"]}><Moderate /></RoleRoute>} />
              <Route path="/history" element={<RoleRoute allowedRoles={["moderator", "admin"]}><HistoryPage /></RoleRoute>} />
              <Route path="/profile" element={<Profile />} />
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
