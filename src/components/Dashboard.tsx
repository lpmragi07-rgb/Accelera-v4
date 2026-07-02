"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlayCircle,
  StopCircle,
  Loader2,
  PhoneOutgoing,
  PhoneForwarded,
  Voicemail,
  PhoneOff,
  Phone,
  Star,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "./Navbar";
import Footer from "./Footer";
import UploadCard from "./UploadCard";
import OperatorsPanel from "./OperatorsPanel";
import LeadsTable from "./LeadsTable";
import type { Campaign, Lead, LeadOutcome, Operator } from "@/types/database";

// Status em que o operador ainda precisa marcar ✓ ▢ ✗ antes do lead "sumir".
const NEEDS_QUALIFICATION: Lead["status"][] = [
  "no_answer",
  "transferred",
  "voicemail",
  "failed",
];

function leadNeedsQualification(lead: Lead) {
  return !lead.outcome && NEEDS_QUALIFICATION.includes(lead.status);
}

function leadIsLive(lead: Lead) {
  return lead.status === "calling" || lead.status === "human_answered";
}

interface DashboardProps {
  userId: string;
  userEmail: string | null;
}

export default function Dashboard({ userId, userEmail }: DashboardProps) {
  const supabase = useMemo(() => createClient(), []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [dialing, setDialing] = useState(false);
  const [dialMsg, setDialMsg] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setCampaigns(data);
      setActiveCampaignId((prev) => prev ?? data[0]?.id ?? null);
    }
  }, [supabase]);

  const loadOperators = useCallback(async () => {
    const { data } = await supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setOperators(data);
  }, [supabase]);

  const loadLeads = useCallback(
    async (campaignId: string) => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (data) setLeads(data);
    },
    [supabase]
  );

  useEffect(() => {
    loadCampaigns();
    loadOperators();

    // Realtime: status dos operadores (disponível/ocupado) muda durante a discagem
    const opChannel = supabase
      .channel("operators-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operators" },
        () => loadOperators()
      )
      .subscribe();

    // Realtime: status das campanhas (running/paused/finished) p/ o botão Parar
    const campChannel = supabase
      .channel("campaigns-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => loadCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(opChannel);
      supabase.removeChannel(campChannel);
    };
  }, [loadCampaigns, loadOperators, supabase]);

  useEffect(() => {
    if (!activeCampaignId) return;
    loadLeads(activeCampaignId);

    // Realtime: acompanha mudanças de status dos leads em tempo real
    const channel = supabase
      .channel(`leads-${activeCampaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `campaign_id=eq.${activeCampaignId}`,
        },
        () => loadLeads(activeCampaignId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCampaignId, supabase, loadLeads]);

  // Polling de segurança: enquanto a campanha está discando (ou há uma ligação
  // em andamento), recarrega leads/operadores a cada 2,5s. Isso garante que o
  // indicador "Discando/Em ligação" apareça mesmo que o Realtime do Supabase
  // não esteja habilitado para a tabela "leads".
  const hasActiveCall = leads.some(
    (l) => l.status === "calling" || l.status === "human_answered"
  );
  const campaignRunning =
    campaigns.find((c) => c.id === activeCampaignId)?.status === "running";
  const shouldPoll = campaignRunning || hasActiveCall;
  useEffect(() => {
    if (!activeCampaignId || !shouldPoll) return;
    const interval = setInterval(() => {
      loadLeads(activeCampaignId);
      loadOperators();
    }, 2500);
    return () => clearInterval(interval);
  }, [activeCampaignId, shouldPoll, loadLeads, loadOperators]);

  async function handleStartDialer() {
    if (!activeCampaignId) return;
    setDialing(true);
    setDialMsg(null);

    const res = await fetch("/api/dialer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: activeCampaignId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setDialMsg(data.error || "Falha ao iniciar o discador.");
    } else {
      setDialMsg(
        data.message ||
          `Discagem automática iniciada para ${data.dispatched} operador(es). O sistema discará os próximos leads sozinho conforme os operadores ficam livres.`
      );
      loadCampaigns(); // atualiza o status (running) para acender o botão Parar
    }
    setDialing(false);
  }

  async function handleStopDialer() {
    if (!activeCampaignId) return;
    setDialing(true);
    setDialMsg(null);

    const res = await fetch("/api/dialer/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: activeCampaignId }),
    });
    const data = await res.json();

    setDialMsg(res.ok ? data.message : data.error || "Falha ao parar o discador.");
    if (res.ok) loadCampaigns();
    setDialing(false);
  }

  // Operador qualifica o lead (interessado / retornar / descartar).
  // outcome = null significa desfazer a escolha (clicar de novo no mesmo botão).
  const setOutcome = useCallback(
    async (leadId: string, outcome: LeadOutcome | null) => {
      // Guarda o valor anterior para reverter caso a persistência falhe
      const previous = leads.find((l) => l.id === leadId)?.outcome ?? null;

      // Atualização otimista para resposta imediata na tela
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, outcome } : l))
      );

      const { error } = await supabase
        .from("leads")
        .update({
          outcome,
          outcome_at: outcome ? new Date().toISOString() : null,
        })
        .eq("id", leadId);

      if (error) {
        // Reverte a tela e avisa o operador (ex.: coluna "outcome" ainda não existe no banco)
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, outcome: previous } : l))
        );
        setDialMsg(
          `Não foi possível salvar a qualificação: ${error.message}. ` +
            `Se a mensagem citar a coluna "outcome", rode a migração migration_outcomes.sql no Supabase.`
        );
      }
    },
    [supabase, leads]
  );

  // Dispara uma ligação manual pela API4Com (retorno de um lead) usando o ramal
  // de um operador livre — em vez de abrir o app de telefone do dispositivo.
  const callLead = useCallback(async (leadId: string) => {
    setDialMsg(null);
    const res = await fetch("/api/calls/single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const data = await res.json();
    setDialMsg(res.ok ? data.message : data.error || "Falha ao discar.");
  }, []);

  // Interrompe a ligação em andamento de um lead (disquei sem querer)
  const cancelCall = useCallback(async (leadId: string) => {
    setDialMsg(null);
    const res = await fetch("/api/calls/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const data = await res.json();
    setDialMsg(res.ok ? data.message : data.error || "Falha ao parar a ligação.");
  }, []);

  // Salva/edita a observação (notes) de um lead com atualização otimista.
  const saveNote = useCallback(
    async (leadId: string, notes: string) => {
      const value = notes.trim() === "" ? null : notes.trim();
      const previous = leads.find((l) => l.id === leadId)?.notes ?? null;

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, notes: value } : l))
      );

      const { error } = await supabase
        .from("leads")
        .update({ notes: value })
        .eq("id", leadId);

      if (error) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, notes: previous } : l))
        );
        setDialMsg(
          `Não foi possível salvar a observação: ${error.message}. ` +
            `Se a mensagem citar a coluna "notes", rode a migração migration_lead_notes.sql no Supabase.`
        );
        return false;
      }
      return true;
    },
    [supabase, leads]
  );

  // Apaga uma campanha (e todos os seus leads, via cascade no banco)
  const deleteCampaign = useCallback(
    async (id: string) => {
      const camp = campaigns.find((c) => c.id === id);
      const ok = window.confirm(
        `Apagar a campanha "${camp?.name ?? ""}" e todos os seus leads? Esta ação não pode ser desfeita.`
      );
      if (!ok) return;

      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) {
        setDialMsg(`Não foi possível apagar a campanha: ${error.message}`);
        return;
      }
      setLeads([]);
      setActiveCampaignId(null);
      await loadCampaigns();
      setDialMsg(`Campanha "${camp?.name ?? ""}" apagada.`);
    },
    [campaigns, supabase, loadCampaigns]
  );

  // Listas separadas por qualificação — SEMPRE da campanha ativa.
  // (leads já vem filtrado por campanha; o guard abaixo deixa isso explícito.)
  const interestedLeads = useMemo(
    () =>
      leads.filter(
        (l) => l.campaign_id === activeCampaignId && l.outcome === "interested"
      ),
    [leads, activeCampaignId]
  );
  const callbackLeads = useMemo(
    () =>
      leads.filter(
        (l) => l.campaign_id === activeCampaignId && l.outcome === "callback"
      ),
    [leads, activeCampaignId]
  );

  // Estatísticas para os cards
  const stats = useMemo(() => {
    const count = (s: Lead["status"][]) =>
      leads.filter((l) => s.includes(l.status)).length;
    return {
      total: leads.length,
      inProgress: count(["queued", "calling", "human_answered"]),
      transferred: count(["transferred"]),
      voicemail: count(["voicemail"]),
      noAnswer: count(["no_answer", "failed"]),
    };
  }, [leads]);

  const pendingCount = leads.filter((l) => l.status === "pending").length;
  const availableOperators = operators.filter((o) => o.status === "available").length;

  // Campanha ativa e se a discagem automática está em execução agora
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;
  const isRunning = activeCampaign?.status === "running";

  // Mapa operadorId -> lead em ligação OU aguardando qualificação do operador.
  const activeCalls = useMemo(() => {
    const map: Record<string, Lead> = {};
    for (const lead of leads) {
      if (!lead.operator_id) continue;
      const live = leadIsLive(lead);
      const needsQual = leadNeedsQualification(lead);
      if (!live && !needsQual) continue;

      const existing = map[lead.operator_id];
      if (!existing) {
        map[lead.operator_id] = lead;
        continue;
      }

      const existingLive = leadIsLive(existing);
      if (live && !existingLive) {
        map[lead.operator_id] = lead;
      } else if (
        !existingLive &&
        needsQual &&
        new Date(lead.updated_at).getTime() >
          new Date(existing.updated_at).getTime()
      ) {
        map[lead.operator_id] = lead;
      }
    }
    return map;
  }, [leads]);

  // Ordenação: em ligação → aguardando qualificação → pendentes → resto.
  const sortedLeads = useMemo(() => {
    const priority = (lead: Lead) => {
      if (leadIsLive(lead)) return 0;
      if (leadNeedsQualification(lead)) return 1;
      if (lead.status === "pending") return 2;
      return 3;
    };

    return [...leads].sort((a, b) => {
      const diff = priority(a) - priority(b);
      if (diff !== 0) return diff;

      // No topo: o mais recente primeiro (acabou de ligar / acabou de cair).
      if (priority(a) <= 1) {
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      }

      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [leads]);

  return (
    <>
      <Navbar userEmail={userEmail} />

      <main className="mx-auto max-w-6xl px-5 py-12">
        {/* Cabeçalho editorial — composição assimétrica com numeral em destaque */}
        <header
          id="painel"
          className="mb-12 grid animate-rise items-end gap-8 border-b border-ink/10 pb-10 lg:grid-cols-[1.5fr_1fr]"
        >
          <div>
            <p className="eyebrow mb-4">Discador automático · API4Com</p>
            <h1 className="font-serif text-6xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
              Painel de
              <br />
              <span className="italic text-accent">Ligações</span>
            </h1>
            <p className="mt-5 max-w-xl text-ink-muted">
              Importe leads, inicie a discagem automática e acompanhe, em tempo
              real, quem cada operador está atendendo neste instante.
            </p>
          </div>

          {/* Bloco de números editoriais: leads totais + operadores livres */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10 shadow-card">
            <div className="bg-paper px-5 py-6">
              <p className="font-serif text-5xl font-semibold leading-none tabular-nums">
                {stats.total}
              </p>
              <p className="mt-2 text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">
                Leads
              </p>
            </div>
            <div className="bg-paper px-5 py-6">
              <p className="font-serif text-5xl font-semibold leading-none tabular-nums text-accent">
                {availableOperators}
              </p>
              <p className="mt-2 text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">
                Operadores livres
              </p>
            </div>
          </div>
        </header>

        {/* Cards de estatística */}
        <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<PhoneOutgoing size={18} />}
            label="Em andamento"
            value={stats.inProgress}
            tone="text-amber-400"
          />
          <StatCard
            icon={<PhoneForwarded size={18} />}
            label="Transferidas"
            value={stats.transferred}
            tone="text-go"
          />
          <StatCard
            icon={<Voicemail size={18} />}
            label="Caixa postal"
            value={stats.voicemail}
            tone="text-orange-400"
          />
          <StatCard
            icon={<PhoneOff size={18} />}
            label="Sem sucesso"
            value={stats.noAnswer}
            tone="text-zinc-400"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <UploadCard
            onUploaded={(id) => {
              loadCampaigns();
              setActiveCampaignId(id);
            }}
          />
          <OperatorsPanel
            userId={userId}
            operators={operators}
            activeCalls={activeCalls}
            onChange={loadOperators}
          />
        </div>

        {/* Controle de disparo + tabela */}
        <section id="ligacoes" className="mt-10">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-ink-muted">
                Campanha ativa
              </label>
              <div className="flex max-w-md items-center gap-2">
                <select
                  value={activeCampaignId ?? ""}
                  onChange={(e) => setActiveCampaignId(e.target.value || null)}
                  className="w-full min-w-0 rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                >
                  {campaigns.length === 0 && <option value="">Nenhuma campanha</option>}
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.total_leads} leads)
                      {c.status === "finished" ? " · concluída" : ""}
                    </option>
                  ))}
                </select>
                {activeCampaignId && (
                  <button
                    onClick={() => deleteCampaign(activeCampaignId)}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-ink/10 px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                    title="Apagar esta campanha e seus leads"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Apagar</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleStartDialer}
                disabled={dialing || !activeCampaignId || pendingCount === 0 || isRunning}
                className="flex items-center justify-center gap-2 rounded-xl bg-go px-5 py-2.5 font-medium text-white shadow-go transition hover:-translate-y-0.5 hover:shadow-gohover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                title={
                  availableOperators === 0
                    ? "Atenção: nenhum operador disponível para discar"
                    : undefined
                }
              >
                {dialing && !isRunning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <PlayCircle size={18} />
                )}
                Iniciar discagem{" "}
                {pendingCount > 0 ? `(${pendingCount} pendentes)` : ""}
              </button>

              <button
                onClick={handleStopDialer}
                disabled={dialing || !isRunning}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-medium text-white shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-muted disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
                title={
                  isRunning
                    ? "Pausar a discagem automática"
                    : "A discagem não está em execução"
                }
              >
                {dialing && isRunning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <StopCircle size={18} />
                )}
                Parar discagem
              </button>
            </div>
          </div>

          {availableOperators === 0 && (
            <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Nenhum operador disponível. Cadastre um operador com ramal e
              marque-o como “Disponível” para iniciar a discagem.
            </p>
          )}

          {dialMsg && (
            <p className="mb-4 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-red-200">
              {dialMsg}
            </p>
          )}

          <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-card">
            <LeadsTable
              leads={sortedLeads}
              onSetOutcome={setOutcome}
              onCancelCall={cancelCall}
            />
          </div>
        </section>

        {/* Listas de qualificação (resultado marcado pelo operador) —
            sempre referentes à campanha selecionada no momento */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <OutcomeList
            title="Interessados — contatar depois"
            subtitle={activeCampaign?.name}
            emptyText="Quando o operador marcar o ✓ verde, o cliente aparece aqui."
            accent="emerald"
            leads={interestedLeads}
            onCall={callLead}
            onSaveNote={saveNote}
          />
          <OutcomeList
            title="Retornar depois"
            subtitle={activeCampaign?.name}
            emptyText="Não atendeu ou “vai pensar” (quadrado amarelo) aparece aqui."
            accent="amber"
            leads={callbackLeads}
            onCall={callLead}
            onSaveNote={saveNote}
          />
        </div>
      </main>

      <Footer />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink/5 bg-paper p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardhover">
      {/* Hairline de acento que cresce no hover (detalhe editorial) */}
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-500 ease-out group-hover:scale-x-100" />
      <div className="flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 ${tone}`}
        >
          {icon}
        </span>
        <p className="font-serif text-4xl font-semibold leading-none tabular-nums">
          {value}
        </p>
      </div>
      <p className="mt-4 text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function OutcomeList({
  title,
  subtitle,
  emptyText,
  accent,
  leads,
  onCall,
  onSaveNote,
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  accent: "emerald" | "amber";
  leads: Lead[];
  onCall: (leadId: string) => Promise<void>;
  onSaveNote: (leadId: string, notes: string) => Promise<boolean>;
}) {
  const [callingId, setCallingId] = useState<string | null>(null);
  // Lead cuja observação está aberta no modal (null = modal fechado)
  const [noteLead, setNoteLead] = useState<Lead | null>(null);

  // Paginação da lista (evita rolagem infinita conforme a lista cresce)
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return leads.slice(start, start + PAGE_SIZE);
  }, [leads, page]);
  const pageItems = getOutcomePageItems(page, totalPages);

  async function handleCall(leadId: string) {
    setCallingId(leadId);
    try {
      await onCall(leadId);
    } finally {
      setCallingId(null);
    }
  }

  const styles = {
    emerald: { icon: <Star size={18} />, chip: "bg-emerald-500/15 text-emerald-300", ring: "text-emerald-400" },
    amber: { icon: <Clock size={18} />, chip: "bg-amber-500/15 text-amber-300", ring: "text-amber-400" },
  }[accent];

  return (
    <section className="rounded-3xl border border-ink/5 bg-paper p-7 shadow-card">
      <div className="mb-5 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 ${styles.ring}`}>
          {styles.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl leading-tight tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Campanha: {subtitle}
            </p>
          )}
        </div>
        <span className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles.chip}`}>
          {leads.length}
        </span>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pageLeads.map((lead) => (
            <li
              key={lead.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-ink/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {lead.company_name || "Sem nome"}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Phone size={13} /> {lead.phone}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Lápis: abre o modal para escrever/ver/editar a observação.
                    Fica preenchido (vermelho) quando já existe observação. */}
                <button
                  onClick={() => setNoteLead(lead)}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    lead.notes
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-ink/10 text-ink-muted hover:bg-ink/5 hover:text-ink"
                  }`}
                  title={
                    lead.notes
                      ? "Ver/editar observação"
                      : "Adicionar observação"
                  }
                >
                  <Pencil size={15} />
                  {lead.notes && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-paper" />
                  )}
                </button>
                <button
                  onClick={() => handleCall(lead.id)}
                  disabled={callingId === lead.id}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-paper shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover disabled:translate-y-0 disabled:opacity-60"
                  title="Discar pela API4Com usando o ramal de um operador livre"
                >
                  {callingId === lead.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Phone size={14} />
                  )}
                  Ligar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Abas de paginação da lista */}
      {totalPages > 1 && (
        <nav
          className="mt-5 flex items-center justify-center gap-1.5"
          aria-label="Paginação"
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          {pageItems.map((item, i) =>
            item === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-ink-muted">
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition ${
                  item === page
                    ? "bg-accent text-white shadow-ember"
                    : "border border-ink/10 text-ink hover:bg-ink/5"
                }`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Próxima página"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}

      {noteLead && (
        <NoteModal
          lead={noteLead}
          onClose={() => setNoteLead(null)}
          onSave={onSaveNote}
        />
      )}
    </section>
  );
}

// Modal de observação do cliente: caixa de texto para escrever, ver e editar.
// Segue o tema do site (fundo escuro, acento vermelho V4).
function NoteModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (leadId: string, notes: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Fecha com a tecla Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave(lead.id, text);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Cartão */}
      <div className="relative w-full max-w-lg animate-rise overflow-hidden rounded-3xl border border-ink/10 bg-paper p-7 shadow-cardhover">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">
              Observação do cliente
            </p>
            <h3 className="mt-1 truncate font-serif text-2xl leading-tight tracking-tight">
              {lead.company_name || "Sem nome"}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <Phone size={13} /> {lead.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition hover:bg-ink/5 hover:text-ink"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Ex.: Cliente pediu para ligar dia 20 às 14h. Tem interesse no plano anual. Contato: João (sócio)."
          className="w-full resize-none rounded-2xl border border-ink/10 bg-ink/5 px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover disabled:translate-y-0 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Salvar observação
          </button>
        </div>
      </div>
    </div>
  );
}

// Sequência de abas com reticências para as listas de qualificação.
function getOutcomePageItems(current: number, total: number): (number | "…")[] {
  const items: (number | "…")[] = [];
  const window = 1;
  for (let p = 1; p <= total; p++) {
    const isEdge = p === 1 || p === total;
    const isNear = p >= current - window && p <= current + window;
    if (isEdge || isNear) {
      items.push(p);
    } else if (items[items.length - 1] !== "…") {
      items.push("…");
    }
  }
  return items;
}
