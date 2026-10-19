import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type Row = { article_slug: string; title: string | null; helpful: number; not_helpful: number };

/** Votos "Este artigo foi útil?" dos últimos 30 dias — primeiro os mais rejeitados. */
export const HelpFeedbackPanel = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    supabase.rpc("help_feedback_summary", { _days: 30 }).then(({ data }) => setRows((data as Row[] | null) ?? []));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Central de Ajuda — votos dos últimos 30 dias</CardTitle>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum voto no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead className="text-right">Útil</TableHead>
                <TableHead className="text-right">Não útil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.article_slug}>
                  <TableCell><Link to={`/ajuda/${r.article_slug}`} className="hover:underline">{r.title ?? r.article_slug}</Link></TableCell>
                  <TableCell className="text-right font-mono">{r.helpful}</TableCell>
                  <TableCell className="text-right font-mono">{r.not_helpful}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
