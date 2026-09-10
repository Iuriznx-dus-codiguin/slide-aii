import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Generate from "./pages/Generate.tsx";
import SlideViewer from "./pages/SlideViewer.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Editor from "./pages/Editor.tsx";
import SettingsPage from "./pages/Settings.tsx";
import Templates from "./pages/Templates.tsx";
import DevDashboard from "./pages/DevDashboard.tsx";
import AdminSupport from "./pages/AdminSupport.tsx";
import HelpCenter from "./pages/HelpCenter.tsx";
import HelpArticle from "./pages/HelpArticle.tsx";
import ProfilePage from "./pages/Profile.tsx";
import Support from "./pages/Support.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import About from "./pages/About.tsx";
import Contact from "./pages/Contact.tsx";
import Privacy from "./pages/Privacy.tsx";
import NotFound from "./pages/NotFound.tsx";
import { DevModePanel } from "./components/DevModePanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SupportWidget } from "./components/SupportWidget";
import { PaymentNotifications } from "./components/PaymentNotifications";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
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
              <Route path="/__dev" element={<ProtectedRoute><DevDashboard /></ProtectedRoute>} />
              <Route path="/admin/suporte" element={<ProtectedRoute><AdminSupport /></ProtectedRoute>} />
              <Route path="/slides/:slug" element={<SlideViewer />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <DevModePanel />
            <PaymentNotifications />
            <SupportWidget />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
