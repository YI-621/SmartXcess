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
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RoleRoute({ children, allowedRoles, fallback }: { children: React.ReactNode; allowedRoles: string[]; fallback?: string }) {
  const { user, loading, roles } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!roles.some((r) => allowedRoles.includes(r))) {
    // Smart redirect based on role
    const redirectTo = fallback || (roles.includes("moderator") ? "/moderate" : roles.includes("lecturer") ? "/" : "/profile");
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
