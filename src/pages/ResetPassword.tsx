import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Redefinir senha — SlideAI"; }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    if (password.length < 6) { toast.error("Senha precisa ter ao menos 6 caracteres"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha atualizada!"); navigate("/dashboard"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-elegant">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <span className="font-display text-2xl font-bold">SlideAI</span>
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground mb-6">Escolha uma senha forte com ao menos 6 caracteres.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Atualizar senha
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
