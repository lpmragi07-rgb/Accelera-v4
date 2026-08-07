"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users2, Copy, Check, LogIn, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMyTeamId } from "@/lib/team";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface TeamPanelProps {
  userEmail: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
  memberCount: number;
}

export default function TeamPanel({ userEmail }: TeamPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    const teamId = await getMyTeamId(supabase);
    if (!teamId) {
      setTeam(null);
      setLoading(false);
      return;
    }

    const [{ data: teamRow }, { count }] = await Promise.all([
      supabase.from("teams").select("id, name").eq("id", teamId).single(),
      supabase.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", teamId),
    ]);

    setTeam(
      teamRow
        ? { id: teamRow.id, name: teamRow.name, memberCount: count ?? 1 }
        : null
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  function copyCode() {
    if (!team) return;
    navigator.clipboard.writeText(team.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;

    setJoining(true);
    setJoinMessage(null);

    const { error } = await supabase.rpc("join_team", { p_team_id: code });

    if (error) {
      setJoinMessage({
        type: "err",
        text: error.message.includes("invalid input syntax")
          ? "Código inválido — confira se copiou certinho."
          : `Não foi possível entrar no time: ${error.message}`,
      });
    } else {
      setJoinMessage({
        type: "ok",
        text: "Pronto! Seus operadores, campanhas e leads já foram movidos para este time. Recarregue o Painel pra ver tudo junto.",
      });
      setJoinCode("");
      await loadTeam();
    }
    setJoining(false);
  }

  return (
    <>
      <Navbar userEmail={userEmail} />

      <main className="mx-auto max-w-3xl px-5 py-12">
        <header className="mb-12 animate-rise border-b border-ink/10 pb-10">
          <p className="eyebrow mb-4">Conta e time</p>
          <h1 className="font-serif text-6xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Sua
            <br />
            <span className="italic text-accent">Equipe</span>
          </h1>
          <p className="mt-5 max-w-xl text-ink-muted">
            Operadores, campanhas e leads são compartilhados dentro de um time. Convide colegas com o código
            abaixo, ou entre num time existente se alguém já te passou um código.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : !team ? (
          <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/10 p-6 text-sm text-red-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            Não foi possível identificar o seu time. Tente recarregar a página.
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                  <Users2 size={18} />
                </span>
                <div>
                  <h2 className="font-serif text-2xl tracking-tight">{team.name}</h2>
                  <p className="text-sm text-ink-muted">
                    {team.memberCount} {team.memberCount === 1 ? "pessoa" : "pessoas"} neste time
                  </p>
                </div>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Código do time (compartilhe com colegas)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm text-ink">
                  {team.id}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5"
                >
                  {copied ? <Check size={15} className="text-go" /> : <Copy size={15} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 text-ink-muted">
                  <LogIn size={18} />
                </span>
                <h2 className="font-serif text-2xl tracking-tight">Entrar em outro time</h2>
              </div>
              <p className="mb-4 text-sm text-ink-muted">
                Cole o código que alguém do outro time te passou. Seus operadores, campanhas e leads atuais serão
                movidos pra esse time — isso não pode ser desfeito sozinho.
              </p>
              <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Cole o código do time aqui"
                  className="w-full flex-1 rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
                <button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover disabled:translate-y-0 disabled:opacity-60"
                >
                  {joining ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  Entrar
                </button>
              </form>
              {joinMessage && (
                <p
                  className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                    joinMessage.type === "ok"
                      ? "border-go/20 bg-go/10 text-emerald-200"
                      : "border-accent/20 bg-accent/10 text-red-200"
                  }`}
                >
                  {joinMessage.text}
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
