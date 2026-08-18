import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LifeBuoy, X, Send, Loader2, Star, ThumbsUp, ThumbsDown, BookOpen,
  History, Minus, Plus, ArrowLeft, ExternalLink, CheckCircle2, Clock3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/errorCapture";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; code?: string | null };
type State = "open" | "diagnosing" | "awaiting_user" | "awaiting_confirmation" | "resolved" | "escalated" | "closed";
type HelpLink = { slug: string; title: string };
type Thread = { id: string; ticket_id: string | null; subject: string | null; state: State; updated_at: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "Olá! Sou o assistente do SlideAI. Me conte o que você precisa: uma dúvida de uso, ou um erro (se souber o código, cite-o — ex: PAY-003).",
};

export const SupportWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [state, setState] = useState<State>("open");
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [rated, setRated] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [helpLinks, setHelpLinks] = useState<HelpLink[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_conversations")
      .select("id,ticket_id,subject,state,updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    setThreads((data as Thread[]) ?? []);
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { code?: string } | undefined;
      if (detail?.code) setErrorCode(detail.code);
      setOpen(true);
      setMinimized(false);
      setShowHistory(false);
    };
    window.addEventListener("slideai:open-support", handler);
    return () => window.removeEventListener("slideai:open-support", handler);
  }, []);

  useEffect(() => {
    if (open && !minimized) loadThreads();
  }, [open, minimized, loadThreads]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, state, minimized, showHistory]);

  useEffect(() => {
    const codes = new Set<string>();
    if (errorCode) codes.add(errorCode);
    messages.forEach((m) => { if (m.code) codes.add(m.code); });
    const list = Array.from(codes);
    if (list.length === 0) { setHelpLinks([]); return; }
    (async () => {
      const { data } = await supabase.from("error_catalog").select("related_articles").in("code", list);
      const slugs = Array.from(new Set((data ?? []).flatMap((r: any) => r.related_articles ?? [])));
      if (slugs.length === 0) { setHelpLinks([]); return; }
      const { data: arts } = await supabase
        .from("help_articles").select("slug, title").in("slug", slugs).eq("is_published", true).limit(5);
      setHelpLinks((arts as HelpLink[]) ?? []);
    })();
  }, [errorCode, messages]);

  const callSupport = async (payload: Record<string, unknown>) =>
    supabase.functions.invoke("support-chat", { body: payload, headers: { "x-slideai-session": getSessionId() } });

  const startNew = () => {
    setConversationId(null);
    setState("open");
    setMessages([WELCOME]);
    setRated(false);
    setShowHistory(false);
  };

  const openThread = async (thread: Thread) => {
    setLoadingThread(true);
    setShowHistory(false);
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,role,content,code_ref,created_at")
      .eq("conversation_id", thread.id)
      .order("created_at", { ascending: true });
    setLoadingThread(false);
    if (error) { toast.error("Não consegui abrir este atendimento."); return; }
    const restored = ((data as any[]) ?? [])
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content, code: m.code_ref }));
    setConversationId(thread.id);
    setState(thread.state);
    setRated(false);
    setMessages(restored.length ? restored : [WELCOME]);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    if (!user) { toast.error("Faça login para usar o suporte."); return; }
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const { data, error } = await callSupport({ message: text, conversation_id: conversationId, error_code: errorCode });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConversationId(data.conversation_id);
      setState(data.state);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, code: data.code }]);
      loadThreads();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Não consegui responder agora. Tente novamente em instantes." }]);
    } finally {
      setSending(false);
    }
  };

  const confirm = async (yes: boolean) => {
    if (!conversationId || sending) return;
    setSending(true);
    try {
      const { data, error } = await callSupport({ conversation_id: conversationId, action: yes ? "confirm_yes" : "confirm_no" });
      if (error) throw error;
      setState(data.state);
      setMessages((m) => [
        ...m,
        { role: "user", content: yes ? "✓ Resolvido" : "✗ Ainda não resolvi" },
        { role: "assistant", content: data.reply },
      ]);
      loadThreads();
    } catch {
      toast.error("Não consegui registrar sua resposta.");
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

  const showConfirmation = state === "awaiting_confirmation";
  const showRating = (state === "resolved" || state === "escalated") && !rated && conversationId;

  return (
    <>
      <button
        onClick={() => { setOpen((v) => !v); setMinimized(false); }}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-elegant flex items-center justify-center hover:scale-105 transition-transform"
        aria-label={open ? "Fechar suporte" : "Abrir suporte"}
      >
        {open ? <X className="h-6 w-6" /> : <LifeBuoy className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-24 right-6 z-50 w-[390px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-elegant flex flex-col overflow-hidden ${
              minimized ? "h-auto" : "h-[580px] max-h-[calc(100vh-8rem)]"
            }`}
          >
            <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-gradient-primary/10">
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm truncate">Suporte SlideAI</h3>
                <p className="text-[10px] text-muted-foreground truncate">
                  {conversationId ? `Estado: ${labelState(state)}` : "Assistente inteligente"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {errorCode && <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded">{errorCode}</span>}
                <button onClick={() => setShowHistory((v) => !v)} aria-label="Histórico de conversas" title="Histórico"
                  className={`p-1.5 rounded-md hover:bg-muted ${showHistory ? "bg-muted text-primary" : ""}`}>
                  <History className="h-4 w-4" />
                </button>
                <button onClick={startNew} aria-label="Nova conversa" title="Nova conversa" className="p-1.5 rounded-md hover:bg-muted">
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={() => setMinimized((v) => !v)} aria-label={minimized ? "Expandir" : "Recolher"} title={minimized ? "Expandir" : "Recolher"} className="p-1.5 rounded-md hover:bg-muted">
                  {minimized ? <ArrowLeft className="h-4 w-4 rotate-90" /> : <Minus className="h-4 w-4" />}
                </button>
              </div>
            </header>

            {!minimized && (showHistory ? (
              <div className="flex-1 overflow-y-auto p-2">
                <div className="px-2 py-2 flex items-center justify-between">
                  <p className="text-xs font-semibold">Seus atendimentos</p>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
                    <Link to="/suporte" onClick={() => setOpen(false)}>Abrir central <ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                </div>
                {threads.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-10">Nenhuma conversa ainda.</p>
                ) : threads.map((t) => (
                  <button key={t.id} onClick={() => openThread(t)}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors ${conversationId === t.id ? "bg-muted" : "hover:bg-muted/60"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{t.subject || "Atendimento"}</span>
                      {t.state === "resolved" || t.state === "closed"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        : <Clock3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">{t.ticket_id ?? "—"}</span>
                      <span>{new Date(t.updated_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {loadingThread && (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                    }`}>
                      {m.content}
                      {m.code && <div className="text-[10px] mt-1 opacity-70 font-mono">Ref: {m.code}</div>}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                    </div>
                  </div>
                )}
                {showConfirmation && !sending && (
                  <div className="border border-primary/30 bg-primary/5 rounded-xl p-3 text-center space-y-2">
                    <p className="text-xs font-medium">Consegui te ajudar?</p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" onClick={() => confirm(true)}><ThumbsUp className="h-3.5 w-3.5" /> Sim, resolvido</Button>
                      <Button size="sm" variant="outline" onClick={() => confirm(false)}><ThumbsDown className="h-3.5 w-3.5" /> Ainda não</Button>
                    </div>
                  </div>
                )}
                {showRating && (
                  <div className="border-t border-border pt-3 text-center">
                    <p className="text-xs text-muted-foreground mb-2">Como foi este atendimento?</p>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => rate(n)} className="p-1 hover:scale-110 transition-transform" aria-label={`Avaliar com ${n}`}>
                          <Star className="h-5 w-5 text-yellow-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {helpLinks.length > 0 && (
                  <div className="border border-primary/20 bg-primary/5 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" /> Artigos de ajuda relacionados
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {helpLinks.map((h) => (
                        <Link key={h.slug} to={`/ajuda/${h.slug}`} onClick={() => setOpen(false)}
                          className="text-[11px] px-2 py-1 rounded-md bg-background border border-border hover:border-primary hover:text-primary transition-colors">
                          {h.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {!minimized && !showHistory && (
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={
                    state === "escalated" ? "Aguardando humano — pode complementar" :
                    state === "awaiting_confirmation" ? "Ou digite se quiser detalhar…" :
                    "Descreva seu problema…"
                  }
                  disabled={sending}
                  autoFocus
                />
                <Button onClick={send} disabled={sending || !input.trim()} size="icon" aria-label="Enviar">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function labelState(s: State): string {
  return ({
    open: "aberta",
    diagnosing: "diagnosticando",
    awaiting_user: "aguardando você",
    awaiting_confirmation: "aguardando confirmação",
    resolved: "resolvida",
    escalated: "encaminhada à equipe",
    closed: "encerrada",
  } as Record<State, string>)[s];
}
