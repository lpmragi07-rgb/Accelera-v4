import type { SupabaseClient } from "@supabase/supabase-js";

// Descobre o time "ativo" (is_primary) do usuário logado — todo insert em
// operators/campaigns/leads precisa desse team_id (ver migration_teams.sql).
// Funciona tanto com o client do navegador quanto com o do servidor, já que
// os dois expõem a mesma interface .from(...).
export async function getMyTeamId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // team_members também é visível pros colegas de time (mesmo team_id), então
  // o filtro por user_id é essencial aqui — sem ele poderíamos pegar a
  // membership primária de outra pessoa do time.
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.team_id as string;
}
