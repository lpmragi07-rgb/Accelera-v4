import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dialNextForOperator, maybeFinishCampaign } from "@/lib/dialer";
import type { Operator } from "@/types/database";

// POST /api/dialer/start
// Body: { campaignId: string }
// Inicia a discagem AUTOMÁTICA CONTÍNUA: coloca a campanha em "running" e
// dispara um lead para cada operador disponível. A partir daí, o webhook de
// encerramento (channel-hangup) vai discando o próximo lead a cada operador
// que fica livre, até a lista de leads acabar.
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId é obrigatório." }, { status: 400 });
  }

  if (!process.env.APP_BASE_URL) {
    return NextResponse.json(
      { error: "APP_BASE_URL não configurada no servidor." },
      { status: 500 }
    );
  }

  // Operadores que aceitam chamadas (status=available), não estão em ligação
  // (on_call=false) e têm ramal. RLS limita ao próprio usuário.
  const { data: operators, error: opError } = await supabase
    .from("operators")
    .select("*")
    .eq("status", "available")
    .eq("on_call", false)
    .not("extension", "is", null);

  if (opError) {
    return NextResponse.json({ error: opError.message }, { status: 500 });
  }

  const availableOperators = (operators ?? []) as Operator[];
  if (availableOperators.length === 0) {
    return NextResponse.json(
      { error: "Nenhum operador disponível com ramal cadastrado." },
      { status: 400 }
    );
  }

  // Marca a campanha como em execução (habilita o loop contínuo no webhook)
  await supabase.from("campaigns").update({ status: "running" }).eq("id", campaignId);

  // Dispara um lead para cada operador disponível
  let dispatched = 0;
  for (const operator of availableOperators) {
    try {
      const lead = await dialNextForOperator(supabase, operator, campaignId);
      if (!lead) break; // acabaram os leads pendentes
      dispatched++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (dispatched === 0) {
    await maybeFinishCampaign(supabase, campaignId);
    return NextResponse.json({ error: "Nenhum lead pendente para discar." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    dispatched,
    message: `Discagem automática iniciada para ${dispatched} operador(es).`,
  });
}
