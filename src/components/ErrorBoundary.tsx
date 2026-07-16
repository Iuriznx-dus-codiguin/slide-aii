import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureError } from "@/lib/errorCapture";

interface Props { children: ReactNode; }
interface State { hasError: boolean; occurrenceId: string | null; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, occurrenceId: null, message: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    const id = await captureError(error, {
      code: "UI-001",
      context: { componentStack: info.componentStack?.slice(0, 800) },
    });
    this.setState({ occurrenceId: id });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-bold">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Já registramos o problema. Você pode tentar recarregar a página ou abrir um chamado no suporte.
          </p>
          <div className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1">
            Código: UI-001{this.state.occurrenceId ? ` · ${this.state.occurrenceId.slice(0, 8)}` : ""}
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => window.location.reload()} variant="default">
              <RefreshCw className="h-4 w-4" /> Recarregar
            </Button>
            <Button onClick={() => window.dispatchEvent(new CustomEvent("slideai:open-support", { detail: { code: "UI-001" } }))} variant="outline">
              <LifeBuoy className="h-4 w-4" /> Abrir suporte
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
