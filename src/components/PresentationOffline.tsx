import { Link } from "react-router-dom";
import { CloudOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDay, HOSTING_GRACE_DAYS, RESTORE_URL } from "@/lib/hosting";

/** Tela de apresentação fora do ar: o dono vê como restaurar; visitantes, só o aviso. */
export const PresentationOffline = ({ isOwner, title, purgeAt }: { isOwner: boolean; title?: string | null; purgeAt?: string | Date | null }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="max-w-md text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-muted items-center justify-center mb-4">
        <CloudOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="font-display text-2xl font-bold">
        {isOwner ? "Esta apresentação está fora do ar" : "Apresentação indisponível"}
      </h1>
      {isOwner ? (
        <>
          {title && <p className="mt-2 font-medium">{title}</p>}
          <p className="text-muted-foreground mt-2">
            Sem plano ativo ou créditos recentes, ela não abre, não edita e o link público fica desativado.
            {purgeAt
              ? <> Reative um plano ou compre créditos até <strong className="text-foreground">{fmtDay(purgeAt)}</strong> para trazê-la de volta, como estava.</>
              : <> Reative um plano ou compre créditos em até {HOSTING_GRACE_DAYS} dias para trazê-la de volta.</>}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">Depois desse prazo, os slides e as imagens são excluídos de vez.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
            <Button asChild variant="hero"><a href={RESTORE_URL}><Zap className="h-4 w-4" /> Restaurar apresentações</a></Button>
            <Button asChild variant="outline"><Link to="/dashboard">Minhas apresentações</Link></Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mt-2">Esta apresentação não está disponível no momento.</p>
          <Link to="/" className="text-primary underline mt-4 inline-block">Conhecer o SlideAI</Link>
        </>
      )}
    </div>
  </div>
);
