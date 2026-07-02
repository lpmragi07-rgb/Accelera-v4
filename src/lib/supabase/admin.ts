import { createClient } from "@supabase/supabase-js";

// Cliente Supabase com a SERVICE ROLE KEY.
// ATENÇÃO: bypassa o RLS. Use SOMENTE no servidor (rotas de API/webhooks),
// jamais exponha ao navegador. É necessário para os webhooks da API4Com,
// que chamam nossas rotas sem um usuário autenticado.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
