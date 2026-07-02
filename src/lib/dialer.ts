import type { SupabaseClient } from "@supabase/supabase-js";
import { doCall } from "@/lib/api4com";
import { toE164 } from "@/lib/phone";
import type { Lead, Operator } from "@/types/database";

const GATEWAY = process.env.API4COM_GATEWAY || "ligaraut";
const DIAL_DELAY_MS = Number(process.env.DIAL_DELAY_MS ?? 7000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dispara, de fato, uma chamada para um lead já reservado a um operador.
// Em sucesso: guarda o id de cancelamento e marca o operador como ocupado.
// Em falha: marca o lead como 'failed' e libera o operador.
async function dispatch(
  supabase: SupabaseClient,
  operator: Operator,
  lead: Lead
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await doCall({
      extension: operator.extension!,
      phone: toE164(lead.phone),
      metadata: { gateway: GATEWAY, leadId: lead.id, operatorId: operator.id },
    });

    await supabase
      .from("leads")
      .update({ provider_call_id: res.id })
      .eq("id", lead.id);

    // Marca o operador como "em ligação" (sem mexer na intenção dele)
    await supabase
      .from("operators")
      .update({ on_call: true })
      .eq("id", operator.id);

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";

    await supabase
      .from("leads")
      .update({ status: "failed", error_message: message })
      .eq("id", lead.id);

    await supabase
      .from("operators")
      .update({ on_call: false })
      .eq("id", operator.id);

    return { ok: false, error: message };
  }
}

// Reserva (atômico) o próximo lead pendente da campanha e dispara para o
// operador. Retorna o lead disparado ou null se não há mais leads pendentes.
export async function dialNextForOperator(
  supabase: SupabaseClient,
  operator: Operator,
  campaignId: string
): Promise<Lead | null> {
  const { data, error } = await supabase.rpc("claim_next_lead", {
    p_campaign_id: campaignId,
    p_operator_id: operator.id,
  });

  if (error) throw new Error(error.message);

  const lead = (Array.isArray(data) ? data[0] : data) as Lead | null;
  if (!lead) return null;

  await dispatch(supabase, operator, lead);
  return lead;
}

// Marca a campanha como finalizada se não houver mais leads pendentes nem em
// andamento (nada na fila e nada discando).
export async function maybeFinishCampaign(
  supabase: SupabaseClient,
  campaignId: string
): Promise<void> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "queued", "calling", "human_answered"]);

  if ((count ?? 0) === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "finished" })
      .eq("id", campaignId);
  }
}

// Continua a fila automática após uma ligação terminar (webhook ou cancelamento).
// Respeita o intervalo entre chamadas e só disca se a campanha ainda estiver
// "running" e o operador continuar "available" e livre (on_call = false).
export async function continueDialingIfRunning(
  supabase: SupabaseClient,
  operatorId: string,
  campaignId: string
): Promise<Lead | null> {
  async function hasActiveLeadForOperator() {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("operator_id", operatorId)
      .in("status", ["calling", "human_answered"]);
    return (count ?? 0) > 0;
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .single();

  if (campaign?.status !== "running") return null;

  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("id", operatorId)
    .single();

  const operatorAcceptsCalls =
    operator &&
    operator.status === "available" &&
    operator.extension &&
    !operator.on_call;

  if (!operatorAcceptsCalls || (await hasActiveLeadForOperator())) return null;

  if (DIAL_DELAY_MS > 0) {
    await sleep(DIAL_DELAY_MS);

    const { data: campaignNow } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .single();

    if (campaignNow?.status !== "running") return null;

    const { data: operatorNow } = await supabase
      .from("operators")
      .select("*")
      .eq("id", operatorId)
      .single();

    if (
      !operatorNow ||
      operatorNow.status !== "available" ||
      !operatorNow.extension ||
      operatorNow.on_call ||
      (await hasActiveLeadForOperator())
    ) {
      return null;
    }

    return dialNextForOperator(
      supabase,
      operatorNow as Operator,
      campaignId
    );
  }

  if (await hasActiveLeadForOperator()) return null;

  return dialNextForOperator(supabase, operator as Operator, campaignId);
}
