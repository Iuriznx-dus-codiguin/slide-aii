import { useEffect, useRef, useState } from "react";
import { LifeBuoy, X, Send, Loader2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; code?: string | null };
type State = "open" | "diagnosing" | "awaiting_user" | "resolved" | "escalated" | "closed";

export const SupportWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [state, setState] = useState<State>("open");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! Sou o assistente do SlideAI. Me conte o que você precisa: uma dúvida de uso, ou um erro (se souber o código, cite-o — ex: PAY-003)." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [rated, setRated] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { code?: string } | undefined;
      if (detail?.code) setErrorCode(detail.code);
      setOpen(true);
    };
    window.addEventListener("slideai:open-support", handler);
    return () => window.removeEventListener("slideai:open-support", handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    if (!input.trim() || sending) return;
    if (!user) { toast.error("Faça login para usar o suporte."); return; }
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { message: text, conversation_id: conversationId, error_code: errorCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConversationId(data.conversation_id);
      setState(data.state);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, code: data.code }]);
      if (data.state === "resolved" || data.state === "escalated") {
        // pronto para avaliar
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Não consegui responder agora. Tente novamente em instantes." }]);
    } finally {
      setSending(false);
    }
  };

  const rate = async (n: number) => {
    if (!conversationId || rated) return;
    await supabase.from("support_conversations").update({ rating: n }).eq("id", conversationId);
    setRated(true);
    toast.success("Obrigado pela avaliação!");
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-elegant flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Abrir suporte"
      >
        {open ? <X className="h-6 w-6" /> : <LifeBuoy className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl shadow-elegant flex flex-col overflow-hidden"
          >
            <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-gradient-primary/10">
              <div>
                <h3 className="font-display font-bold text-sm">Suporte SlideAI</h3>
                <p className="text-[10px] text-muted-foreground">
                  {conversationId ? `Estado: ${labelState(state)}` : "Assistente inteligente"}
                </p>
              </div>
              {errorCode && (
                <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded">{errorCode}</span>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {m.content}
                    {m.code && (
                      <div className="text-[10px] mt-1 opacity-70 font-mono">Ref: {m.code}</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                  </div>
                </div>
              )}
              {(state === "resolved" || state === "escalated") && !rated && conversationId && (
                <div className="border-t border-border pt-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">Como foi este atendimento?</p>
                  <div className="flex justify-center gap-1">
                    {[1,2,3,4,5].map((n) => (
                      <button key={n} onClick={() => rate(n)} className="p-1 hover:scale-110 transition-transform">
                        <Star className="h-5 w-5 text-yellow-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={state === "escalated" ? "Aguardando humano — pode complementar" : "Descreva seu problema…"}
                disabled={sending}
                autoFocus
              />
              <Button onClick={send} disabled={sending || !input.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function labelState(s: State): string {
  return { open: "aberta", diagnosing: "diagnosticando", awaiting_user: "aguardando você",
    resolved: "resolvida", escalated: "encaminhada à equipe", closed: "encerrada" }[s];
}
