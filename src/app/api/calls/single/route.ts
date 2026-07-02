import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { doCall } from "@/lib/api4com";
import { toE164 } from "@/lib/phone";
import type { Lead, Operator } from "@/types/database";

const GATEWAY = process.env.API4COM_GATEWAY || "ligaraut";

// POST /api/calls/single
// Body: { leadId: string }
// Dispara UMA chamada manual (ex.: retorno de um lead "interessado") pela
// API4Com, conectando o ramal de um operador livre ao telefone do lead.
// Diferente do discador automático, NÃO coloca a campanha em "running".
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

  // Carrega o lead (RLS garante que pertence ao usuário)
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  // Escolhe um operador livre (disponível, sem ligação ativa e com ramal)
  const { data: operators, error: opError } = await supabase
    .from("operators")
    .select("*")
    .eq("status", "available")
    .eq("on_call", false)
    .not("extension", "is", null)
    .limit(1);

  if (opError) {
    return NextResponse.json({ error: opError.message }, { status: 500 });
  }

  const operator = (operators ?? [])[0] as Operator | undefined;
  if (!operator) {
    return NextResponse.json(
      {
        error:
          "Nenhum operador disponível para a ligação. Marque um operador como “Disponível” (sem estar em ligação) e com ramal cadastrado.",
      },
      { status: 400 }
    );
  }

  // Dispara a chamada pela API4Com (ramal do operador -> telefone do lead)
  try {
    const res = await doCall({
      extension: operator.extension!,
      phone: toE164(lead.phone),
      metadata: { gateway: GATEWAY, leadId: lead.id, operatorId: operator.id },
    });

    await supabase
      .from("leads")
      .update({
        status: "calling",
        operator_id: operator.id,
        provider_call_id: res.id,
        error_message: null,
      })
      .eq("id", lead.id);

    await supabase
      .from("operators")
      .update({ on_call: true })
      .eq("id", operator.id);

    return NextResponse.json({
      success: true,
      operator: operator.name,
      extension: operator.extension,
      message: `Discando ${lead.company_name || lead.phone} pelo ramal ${operator.extension} (${operator.name}).`,
    });
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
