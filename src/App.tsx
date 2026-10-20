import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EntitlementProvider } from "@/components/EntitlementProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import { DevModePanel } from "./components/DevModePanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SupportWidget } from "./components/SupportWidget";
import { PaymentNotifications } from "./components/PaymentNotifications";
import { LegalConsentGate } from "./components/legal/LegalConsentGate";
import { AnalyticsTracker } from "./components/AnalyticsTracker";

// Páginas sob demanda: o pacote inicial levava as 25 páginas (editor,
// exportações, gráficos, chat) até para quem só abria a home.
// Depois de uma publicação, uma aba antiga pode pedir um arquivo que não
// existe mais: recarrega a página uma vez em vez de mostrar erro.
const CHUNK_RELOAD_KEY = "slideai:chunk-reload";
const lazyPage = (load: () => Promise<{ default: ComponentType }>) =>
  lazy(() =>
    load()
      .then((mod) => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage indisponível */ }
        return mod;
      })
      .catch((err) => {
        let reloaded = true;
        try {
          reloaded = !!sessionStorage.getItem(CHUNK_RELOAD_KEY);
          if (!reloaded) sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        } catch { /* storage indisponível: não arrisca loop de recarga */ }
        if (!reloaded) {
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      }),
  );
const Auth = lazyPage(() => import("./pages/Auth.tsx"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword.tsx"));
const Onboarding = lazyPage(() => import("./pages/Onboarding.tsx"));
const Generate = lazyPage(() => import("./pages/Generate.tsx"));
const SlideViewer = lazyPage(() => import("./pages/SlideViewer.tsx"));
const Dashboard = lazyPage(() => import("./pages/Dashboard.tsx"));
const Editor = lazyPage(() => import("./pages/Editor.tsx"));
const SettingsPage = lazyPage(() => import("./pages/Settings.tsx"));
const Templates = lazyPage(() => import("./pages/Templates.tsx"));
const DevDashboard = lazyPage(() => import("./pages/DevDashboard.tsx"));
const AdminSupport = lazyPage(() => import("./pages/AdminSupport.tsx"));
const HelpCenter = lazyPage(() => import("./pages/HelpCenter.tsx"));
const HelpArticle = lazyPage(() => import("./pages/HelpArticle.tsx"));
const ProfilePage = lazyPage(() => import("./pages/Profile.tsx"));
const Support = lazyPage(() => import("./pages/Support.tsx"));
const PublicProfile = lazyPage(() => import("./pages/PublicProfile.tsx"));
const About = lazyPage(() => import("./pages/About.tsx"));
const Contact = lazyPage(() => import("./pages/Contact.tsx"));
const Privacy = lazyPage(() => import("./pages/Privacy.tsx"));
const Terms = lazyPage(() => import("./pages/Terms.tsx"));
const OAuthConsent = lazyPage(() => import("./pages/OAuthConsent.tsx"));
const NotFound = lazyPage(() => import("./pages/NotFound.tsx"));
const EmailPreferences = lazyPage(() => import("./pages/EmailPreferences.tsx"));
const Success = lazyPage(() => import("./pages/Success.tsx"));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnalyticsTracker />
        <AuthProvider>
          <EntitlementProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/gerar" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/editor/:slug" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/suporte" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/suporte/:conversationId" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/u/:username" element={<PublicProfile />} />
              <Route path="/ajuda" element={<HelpCenter />} />
              <Route path="/ajuda/:slug" element={<HelpArticle />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/termos-de-uso" element={<Navigate to="/termos" replace />} />
              <Route path="/emails/preferencias" element={<EmailPreferences />} />
              <Route path="/sucesso" element={<Success />} />
              <Route path="/suceso" element={<Navigate to="/sucesso" replace />} />
              <Route path="/cookies" element={<Navigate to={{ pathname: "/privacidade", hash: "#cookies" }} replace />} />
              <Route path="/__dev" element={<ProtectedRoute><DevDashboard /></ProtectedRoute>} />
              <Route path="/admin/suporte" element={<ProtectedRoute><AdminSupport /></ProtectedRoute>} />
              <Route path="/slides/:slug" element={<SlideViewer />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <DevModePanel />
            <PaymentNotifications />
            <LegalConsentGate />
            <SupportWidget />
          </ErrorBoundary>
          </EntitlementProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
