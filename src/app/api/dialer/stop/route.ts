import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/dialer/stop
// Body: { campaignId: string }
// Para a discagem automática: coloca a campanha em "paused". O webhook de
// encerramento (channel-hangup) só dispara o próximo lead quando a campanha
// está "running", então pausar interrompe o loop contínuo. Chamadas já em
// andamento seguem até o cliente/operador desligar (não são cortadas).
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

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", campaignId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Discagem automática pausada. As ligações em andamento continuam até serem encerradas.",
  });
}
