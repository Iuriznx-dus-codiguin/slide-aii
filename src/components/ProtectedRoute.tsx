import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { NoIndex } from "@/components/NoIndex";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Área logada: fora do índice dos buscadores (robots.txt também bloqueia).
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NoIndex />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Volta para a página pedida depois do login (antes caía sempre no painel).
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }
  return <><NoIndex />{children}</>;
};
