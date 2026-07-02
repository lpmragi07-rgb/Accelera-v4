import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Evita cache estático: cada execução deve bater no banco de verdade.
export const dynamic = "force-dynamic";

// GET /api/keep-alive
// Ping leve no Supabase para manter o projeto ativo no plano Free.
// Chamado automaticamente pelo Vercel Cron Job (vercel.json).
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Query mínima: só confirma conectividade e registra atividade no banco.
    const { error } = await supabase
      .from("campaigns")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase keep-alive executado com sucesso.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
