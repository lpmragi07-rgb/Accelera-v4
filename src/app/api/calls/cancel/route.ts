import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hangupCall } from "@/lib/api4com";
import {
  continueDialingIfRunning,
  maybeFinishCampaign,
} from "@/lib/dialer";
import type { Lead } from "@/types/database";

// POST /api/calls/cancel
// Body: { leadId: string }
// Interrompe a ligação em andamento, libera o operador e retoma a fila
// automática (se a campanha ainda estiver em "running").
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId é obrigatório." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  if (lead.status !== "calling" && lead.status !== "human_answered") {
    return NextResponse.json(
      { error: "Este lead não está em ligação no momento." },
      { status: 409 }
    );
  }

  // Tenta encerrar na API4Com quando já temos o id da chamada.
  if (lead.provider_call_id) {
    try {
      await hangupCall(lead.provider_call_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      const alreadyEnded = /não encontrad|not found|404/i.test(message);
      if (!alreadyEnded) {
        return NextResponse.json(
          { error: `Não foi possível encerrar a ligação: ${message}` },
          { status: 502 }
        );
      }
    }
  }

  await supabase
    .from("leads")
    .update({
      status: "no_answer",
      error_message: "Ligação interrompida manualmente.",
    })
    .eq("id", lead.id);

  if (lead.operator_id) {
    await supabase
      .from("operators")
      .update({ on_call: false })
      .eq("id", lead.operator_id);
  }

  // Retoma a fila automática após o intervalo de qualificação (7s).
  const admin = createAdminClient();
  let dialedNext = false;

  if (lead.operator_id) {
    const next = await continueDialingIfRunning(
      admin,
      lead.operator_id,
      lead.campaign_id
    );
    dialedNext = Boolean(next);

    if (!next) {
      await maybeFinishCampaign(admin, lead.campaign_id);
    }
  }

  return NextResponse.json({
    success: true,
    message: dialedNext
      ? `Ligação para ${lead.company_name || lead.phone} interrompida. Próximo cliente será discado em instantes.`
      : `Ligação para ${lead.company_name || lead.phone} interrompida.`,
    dialedNext,
  });
}
