import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  continueDialingIfRunning,
  maybeFinishCampaign,
} from "@/lib/dialer";
import type { Api4ComWebhookEvent } from "@/lib/api4com";
import type { LeadStatus } from "@/types/database";

// Mantém a função aberta o suficiente para o intervalo entre ligações (7s)
export const maxDuration = 30;

// POST /api/api4com/events?secret=...
// Recebe os webhooks da API4Com (channel-answer / channel-hangup).
// A API4Com não assina os webhooks, então protegemos com um segredo na URL.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (
    !process.env.API4COM_WEBHOOK_SECRET ||
    secret !== process.env.API4COM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const event = (await req.json()) as Api4ComWebhookEvent;

  // O leadId foi enviado em metadata no momento do disparo
  const leadId = event.metadata?.leadId
    ? String(event.metadata.leadId)
    : null;
  const operatorId = event.metadata?.operatorId
    ? String(event.metadata.operatorId)
    : null;

  if (!leadId) {
    // Sem leadId não há o que atualizar (ex.: chamada manual fora do discador)
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  if (event.eventType === "channel-answer") {
    // Operador conectado a alguém (humano atendeu): chamada em conversa.
    // Guardamos o event.id (id REAL da chamada na API4Com) em provider_call_id,
    // pois é esse id que o endpoint /calls/{id}/hangup usa para encerrar. O id
    // retornado pelo /dialer nem sempre serve para o hangup.
    await supabase
      .from("leads")
      .update({
        status: "human_answered" as LeadStatus,
        provider_call_id: event.id ?? null,
      })
      .eq("id", leadId);
    return NextResponse.json({ ok: true });
  }

  if (event.eventType === "channel-hangup") {
    // Define o desfecho final com base na duração / atendimento.
    // (A API4Com não expõe "humano vs máquina" explicitamente no webhook;
    //  inferimos pelo fato de a chamada ter sido atendida e ter duração.)
    const wasAnswered = Boolean(event.answeredAt) && (event.duration ?? 0) > 0;
    const finalStatus: LeadStatus = wasAnswered ? "transferred" : "no_answer";

    // Descobre a campanha e o status atual do lead
    const { data: lead } = await supabase
      .from("leads")
      .select("campaign_id, status")
      .eq("id", leadId)
      .single();

    // Idempotência: se o lead já não está mais "em ligação" (ex.: cancelamento
    // manual ou reenvio do webhook), não reprocessa o encerramento — mas ainda
    // tenta retomar a fila caso o próximo cliente não tenha sido discado.
    if (
      !lead ||
      (lead.status !== "calling" && lead.status !== "human_answered")
    ) {
      if (operatorId && lead?.campaign_id) {
        await continueDialingIfRunning(
          supabase,
          operatorId,
          lead.campaign_id
        );
      }
      return NextResponse.json({ ok: true, alreadyHandled: true });
    }

    await supabase
      .from("leads")
      .update({ status: finalStatus, record_url: event.recordUrl ?? null })
      .eq("id", leadId);

    if (!operatorId) {
      return NextResponse.json({ ok: true });
    }

    // A ligação terminou: operador não está mais "em ligação"
    await supabase
      .from("operators")
      .update({ on_call: false })
      .eq("id", operatorId);

    const next = await continueDialingIfRunning(
      supabase,
      operatorId,
      lead.campaign_id
    );

    if (next) {
      return NextResponse.json({ ok: true, dialedNext: next.id });
    }

    await maybeFinishCampaign(supabase, lead.campaign_id);
    return NextResponse.json({ ok: true, queueEmpty: true });
  }

  return NextResponse.json({ ok: true });
}
