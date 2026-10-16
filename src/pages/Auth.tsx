import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptCurrentTerms, signupConsentMetadata } from "@/lib/legalConsent";
import { safeNextPath } from "@/lib/safeRedirect";
import { z } from "zod";

const emailSchema = z.string().trim().email("Email inválido").max(255);
// Login aceita as senhas antigas (mínimo 6); contas novas exigem 8.
const passwordSchema = z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(100);
const newPasswordSchema = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(100);
const nameSchema = z.string().trim().min(1, "Nome obrigatório").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // Aceite dos Termos no cadastro (clickwrap). O registro com IP e horário
  // do servidor é feito no primeiro acesso já autenticado (LegalConsentGate).
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Destino pós-login: usado pela tela de consentimento OAuth (integrações de
  // agentes), que precisa que o usuário volte exatamente para o pedido.
  // Só aceitamos caminhos do próprio site (safeNextPath).
  const nextPath = safeNextPath(searchParams.get("next"));
  const afterAuth = nextPath ?? "/dashboard";

  useEffect(() => {
    document.title = "Entrar — SlideAI";
    if (user) {
      const stored = sessionStorage.getItem("auth_next");
      sessionStorage.removeItem("auth_next");
      const safe = stored && /^\/(?!\/)/.test(stored) ? stored : null;
      navigate(nextPath ?? safe ?? "/dashboard");
    }
  }, [user, navigate, nextPath]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Bem-vindo de volta!"); navigate(afterAuth); }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;
    try {
      nameSchema.parse(fullName);
      emailSchema.parse(email);
      newPasswordSchema.parse(password);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "Dados inválidos");
      return;
    }
    if (!acceptTerms) {
      toast.error("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath ?? "/onboarding"}`,
        data: { full_name: fullName, ...signupConsentMetadata() },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("rate")
          ? "Muitas tentativas de envio de email. Aguarde alguns minutos e tente novamente."
          : error.message,
      );
      return;
    }
    setPendingEmail(email);
    if (data.session) {
      await acceptCurrentTerms("signup");
      toast.success("Conta criada!");
      navigate("/onboarding");
    } else {
      // Confirmação por email ativa: o usuário ainda NÃO está logado.
      setAwaitingConfirmation(true);
      toast.success("Enviamos um link de confirmação para o seu email.");
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}${nextPath ?? "/onboarding"}` },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Email reenviado. Confira também a caixa de spam.");
  };

  const handleGoogle = async () => {
    setLoading(true);
    if (nextPath) sessionStorage.setItem("auth_next", nextPath);
    else sessionStorage.removeItem("auth_next");
    // Retorno sem parâmetros extras; o destino fica guardado na sessão.
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    sessionStorage.removeItem("auth_next");
    navigate(afterAuth);
  };


  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (new FormData(e.currentTarget).get("email") as string);
    try { emailSchema.parse(email); } catch { toast.error("Email inválido"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Email de recuperação enviado!"); setShowReset(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-40 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="flex items-center justify-center mb-8">
          <BrandLogo size={40} />
        </Link>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-elegant">
          {awaitingConfirmation ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold">Confirme seu email</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de confirmação para <strong className="text-foreground">{pendingEmail}</strong>.
                Clique no link para ativar sua conta. Se não encontrar, verifique a caixa de <strong className="text-foreground">spam</strong> ou promoções.
              </p>
              <Button variant="outline" className="w-full" onClick={handleResend} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Reenviar email
              </Button>
              <button
                type="button"
                onClick={() => { setAwaitingConfirmation(false); setPendingEmail(null); }}
                className="text-sm text-muted-foreground hover:text-foreground w-full"
              >
                Voltar ao login
              </button>
            </div>
          ) : showReset ? (

            <form onSubmit={handleReset} className="space-y-4">
              <h1 className="font-display text-2xl font-bold">Recuperar senha</h1>
              <p className="text-sm text-muted-foreground">Enviaremos um link para redefinir sua senha.</p>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" name="email" type="email" required />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar link
              </Button>
              <button type="button" onClick={() => setShowReset(false)} className="text-sm text-muted-foreground hover:text-foreground w-full">
                Voltar
              </button>
            </form>
          ) : (
            <Tabs defaultValue="signup">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full mb-6 h-11 flex items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-[#ffffff] text-[#3c4043] text-sm font-medium hover:bg-[#f8f9fa] transition-colors disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar com Google"}
              </button>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input id="login-password" name="password" type="password" required />
                  </div>
                  <button type="button" onClick={() => setShowReset(true)} className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </button>
                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input id="signup-name" name="fullName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha (mín. 8 caracteres)</Label>
                    <Input id="signup-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  </div>
                  <label htmlFor="signup-terms" className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    <Checkbox id="signup-terms" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
                    <span>
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link> e a{" "}
                      <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>.
                      Declaro ter 18 anos ou mais, ou autorização dos meus pais ou responsáveis.
                    </span>
                  </label>
                  {/* Transparência (Termos 20.2–20.3): uma única caixa de aceite; o relacionamento por e-mail tem descadastro em um clique. */}
                  <p className="text-[11px] leading-relaxed text-muted-foreground -mt-1 pl-6">
                    Você vai receber avisos da conta e, de vez em quando, dicas e ofertas por e-mail. Dá para se descadastrar
                    em um clique, a qualquer momento.
                  </p>
                  <Button type="submit" variant="hero" className="w-full" disabled={loading || !acceptTerms}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar conta
                  </Button>
                </form>
              </TabsContent>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                Ao continuar, você concorda com os{" "}
                <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link> e a{" "}
                <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
              </p>
            </Tabs>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
