import { sendPlatformEmail } from "@/lib/platformEmail";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** "local" (padrão): só este navegador. "global": todas as sessões da conta. */
  signOut: (scope?: "local" | "global") => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, loading: true, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      // Boas-vindas: o servidor garante envio único por conta.
      if (event === "SIGNED_IN" && s?.user?.email_confirmed_at) {
        const key = `slideai-welcome-${s.user.id}`;
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, "1");
          setTimeout(() => { void sendPlatformEmail({ event: "welcome" }); }, 0);
        }
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // O padrão do Supabase é "global": o "Sair" do painel derrubava a conta em
  // todos os dispositivos.
  const signOut = async (scope: "local" | "global" = "local") => {
    await supabase.auth.signOut({ scope });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
