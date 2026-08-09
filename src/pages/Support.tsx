import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, LifeBuoy, Menu, MessageSquarePlus, PanelLeftClose } from "lucide-react";
import type { ChatStatus, UIMessage } from "ai";
import { BrandLogo } from "@/components/BrandLogo";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/errorCapture";
import { toast } from "sonner";

type Thread = { id: string; ticket_id: string | null; subject: string | null; state: string; updated_at: string };
type StoredMessage = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

const welcomeMessage = (id = "welcome"): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: "Olá! Sou o suporte inteligente do SlideAI. Posso orientar sobre geração, edição, animações, imagens, exportação, planos, pagamentos, conta e portfólio. Como posso ajudar?" }],
});

const toUIMessage = (message: StoredMessage): UIMessage => ({
  id: message.id,
  role: message.role === "system" ? "assistant" : message.role,
  parts: [{ type: "text", text: message.content }],
});

export default function Support() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([welcomeMessage()]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !conversationId || conversationId === "nova";

  const focusComposer = useCallback(() => window.setTimeout(() => textareaRef.current?.focus(), 80), []);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase.from("support_conversations")
      .select("id,ticket_id,subject,state,updated_at").order("updated_at", { ascending: false });
    if (error) return toast.error("Não foi possível carregar os atendimentos.");
    setThreads((data as Thread[]) ?? []);
  }, []);

  useEffect(() => {
    document.title = "Suporte — SlideAI";
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (isNew) {
      setMessages([welcomeMessage()]);
      focusComposer();
      return;
    }
    setStatus("submitted");
    supabase.from("support_messages").select("id,role,content,created_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Atendimento não encontrado.");
          navigate("/suporte/nova", { replace: true });
        } else {
          const restored = ((data as StoredMessage[]) ?? []).filter((m) => m.role !== "system").map(toUIMessage);
          setMessages(restored.length ? restored : [welcomeMessage(`welcome-${conversationId}`)]);
        }
        setStatus("ready");
        focusComposer();
      });
  }, [conversationId, focusComposer, isNew, navigate]);

  const send = async ({ text }: PromptInputMessage) => {
    const value = text.trim();
    if (!value || status === "submitted") return;
    const optimistic: UIMessage = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: value }] };
    setMessages((current) => [...current, optimistic]);
    setStatus("submitted");
    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { message: value, conversation_id: isNew ? null : conversationId },
        headers: { "x-slideai-session": getSessionId() },
      });
      if (error || data?.error) throw error ?? new Error(data.error);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: data.reply }],
      }]);
      await loadThreads();
      if (isNew && data.conversation_id) navigate(`/suporte/${data.conversation_id}`, { replace: true });
    } catch {
      setStatus("error");
      toast.error("Não foi possível enviar. Sua mensagem foi preservada para tentar novamente.");
      focusComposer();
      return;
    }
    setStatus("ready");
    focusComposer();
  };

  const threadList = (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="border-b border-border p-4">
        <Button className="w-full" onClick={() => navigate("/suporte/nova")}>
          <MessageSquarePlus className="h-4 w-4" /> Novo atendimento
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">Seus atendimentos aparecerão aqui.</p>
        ) : threads.map((thread) => (
          <button key={thread.id} onClick={() => navigate(`/suporte/${thread.id}`)}
            className={`mb-1 w-full rounded-md px-3 py-3 text-left transition-colors ${conversationId === thread.id ? "bg-background shadow-sm" : "hover:bg-background/70"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{thread.subject || "Atendimento"}</span>
              {thread.state === "resolved" || thread.state === "closed" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Clock3 className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{thread.ticket_id ?? "Suporte"}</span>
              <span>{new Date(thread.updated_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" aria-label="Voltar ao dashboard"><ArrowLeft className="h-5 w-5 text-muted-foreground" /></Link>
          <BrandLogo size={34} />
          <Badge variant="secondary" className="hidden sm:inline-flex">Suporte</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/ajuda"><BookOpen /> Central de Ajuda</Link></Button>
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0">{threadList}</SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <aside className="hidden w-72 shrink-0 border-r border-border md:block">{threadList}</aside>}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
            <div>
              <h1 className="text-sm font-bold">{isNew ? "Novo atendimento" : threads.find((t) => t.id === conversationId)?.subject || "Atendimento"}</h1>
              <p className="text-[11px] text-muted-foreground">Histórico sincronizado com sua conta</p>
            </div>
            <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setSidebarOpen((value) => !value)} title="Alternar histórico">
              <PanelLeftClose className={`h-4 w-4 ${sidebarOpen ? "" : "rotate-180"}`} />
            </Button>
          </div>

          <Conversation className="min-h-0">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-5 px-4 py-8 md:px-8">
              {messages.length === 0 ? <ConversationEmptyState title="Novo atendimento" description="Descreva sua dúvida para começar." icon={<LifeBuoy className="h-8 w-8" />} /> : messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent className={message.role === "user" ? "bg-primary text-primary-foreground" : undefined}>
                    {message.parts.map((part, index) => part.type === "text" ? <MessageResponse key={index}>{part.text}</MessageResponse> : null)}
                  </MessageContent>
                </Message>
              ))}
              {status === "submitted" && <Message from="assistant"><MessageContent><Shimmer>Pensando e consultando a central de ajuda...</Shimmer></MessageContent></Message>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border bg-background p-3 md:p-4">
            <PromptInput onSubmit={send} className="mx-auto max-w-3xl">
              <PromptInputTextarea ref={textareaRef} placeholder="Descreva sua dúvida sobre o SlideAI..." disabled={status === "submitted"} />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={status === "submitted"} />
              </PromptInputFooter>
            </PromptInput>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">Não envie senhas, tokens ou dados completos de pagamento.</p>
          </div>
        </main>
      </div>
    </div>
  );
}