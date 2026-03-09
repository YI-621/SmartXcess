import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function RoleRoute({ children, allowedRoles, fallback }: { children: React.ReactNode; allowedRoles: string[]; fallback?: string }) {
  const { user, loading, activeRole, roles } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  
  const currentRole = activeRole ?? roles[0];
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    const redirectTo = fallback || (currentRole === "moderator" ? "/moderate" : currentRole === "lecturer" ? "/dashboard" : "/profile");
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
