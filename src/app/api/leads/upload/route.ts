import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseLeadsCsv } from "@/lib/csv";
import { toE164 } from "@/lib/phone";

// POST /api/leads/upload
// Recebe um CSV (multipart/form-data) + nome da campanha.
// Cria a campanha e insere os leads. Protegido por sessão (RLS).
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const campaignName =
    (formData.get("campaignName") as string | null)?.trim() ||
    `Campanha ${new Date().toLocaleString("pt-BR")}`;

  if (!file) {
    return NextResponse.json({ error: "Arquivo CSV não enviado." }, { status: 400 });
  }

  const content = await file.text();
  const { leads, errors } = parseLeadsCsv(content);

  if (leads.length === 0) {
    return NextResponse.json(
      { error: "Nenhum lead válido encontrado no CSV.", details: errors },
      { status: 400 }
    );
  }

  // Cria a campanha
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: campaignName,
      status: "draft",
      total_leads: leads.length,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: "Falha ao criar campanha.", details: campaignError?.message },
      { status: 500 }
    );
  }

  // Insere os leads normalizando o telefone para E.164
  const rows = leads.map((l) => ({
    user_id: user.id,
    campaign_id: campaign.id,
    company_name: l.company_name,
    phone: toE164(l.phone),
    status: "pending" as const,
  }));

  const { error: leadsError } = await supabase.from("leads").insert(rows);

  if (leadsError) {
    return NextResponse.json(
      { error: "Falha ao inserir leads.", details: leadsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    campaign,
    inserted: rows.length,
    warnings: errors,
  });
}
