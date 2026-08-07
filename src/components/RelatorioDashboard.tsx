"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PhoneOutgoing,
  PhoneForwarded,
  Voicemail,
  PhoneOff,
  Check,
  Square,
  X,
  Percent,
  Printer,
  Trophy,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CampaignComparisonChart from "./CampaignComparisonChart";
import type { Campaign, Operator, LeadStatus, LeadOutcome } from "@/types/database";

// Recorte de "leads" só com as colunas usadas no relatório — mais leve que
// carregar a linha inteira (empresa, telefone, gravação etc. não importam aqui).
interface DayLeadRow {
  id: string;
  campaign_id: string;
  operator_id: string | null;
  status: LeadStatus;
  outcome: LeadOutcome | null;
  updated_at: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatFullDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇 1º lugar do dia";
  if (rank === 2) return "🥈 2º lugar do dia";
  if (rank === 3) return "🥉 3º lugar do dia";
  return `${rank}º lugar do dia`;
}

interface RelatorioDashboardProps {
  userId: string;
  userEmail: string | null;
}

export default function RelatorioDashboard({ userEmail }: RelatorioDashboardProps) {
  const supabase = useMemo(() => createClient(), []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [dayLeads, setDayLeads] = useState<DayLeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [operatorId, setOperatorId] = useState("");
  const [campaignId, setCampaignId] = useState("");

  useEffect(() => {
    supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setCampaigns(data));

    supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => data && setOperators(data));
  }, [supabase]);

  const loadDayLeads = useCallback(
    async (dateStr: string) => {
      setLoading(true);
      const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
      const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from("leads")
        .select("id, campaign_id, operator_id, status, outcome, updated_at")
        .gte("updated_at", dayStart)
        .lte("updated_at", dayEnd);
      setDayLeads((data as DayLeadRow[]) || []);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    loadDayLeads(date);
  }, [date, loadDayLeads]);

  // Leads deste operador, nesta campanha, atualizados no dia selecionado.
  const operatorCampaignLeads = useMemo(
    () => dayLeads.filter((l) => l.campaign_id === campaignId && l.operator_id === operatorId),
    [dayLeads, campaignId, operatorId]
  );

  const metrics = useMemo(() => {
    const total = operatorCampaignLeads.length;
    const transferred = operatorCampaignLeads.filter((l) => l.status === "transferred").length;
    const voicemail = operatorCampaignLeads.filter((l) => l.status === "voicemail").length;
    const noAnswer = operatorCampaignLeads.filter((l) => l.status === "no_answer" || l.status === "failed").length;
    const interested = operatorCampaignLeads.filter((l) => l.outcome === "interested").length;
    const callback = operatorCampaignLeads.filter((l) => l.outcome === "callback").length;
    const discarded = operatorCampaignLeads.filter((l) => l.outcome === "discarded").length;
    const taxaConversao = total > 0 ? (interested / total) * 100 : 0;
    return { total, transferred, voicemail, noAnswer, interested, callback, discarded, taxaConversao };
  }, [operatorCampaignLeads]);

  // Comparação entre campanhas no dia (todos os operadores) — quem converteu
  // mais interessados, pra saber onde a campanha selecionada se posiciona.
  const comparison = useMemo(() => {
    return campaigns
      .map((c) => {
        const leads = dayLeads.filter((l) => l.campaign_id === c.id);
        const interested = leads.filter((l) => l.outcome === "interested").length;
        return { campaignId: c.id, campaignName: c.name, interested };
      })
      .sort((a, b) => b.interested - a.interested);
  }, [campaigns, dayLeads]);

  const rank = campaignId ? comparison.findIndex((c) => c.campaignId === campaignId) + 1 || null : null;

  const selectedOperator = operators.find((o) => o.id === operatorId);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const showReport = Boolean(operatorId && campaignId);

  return (
    <>
      <Navbar userEmail={userEmail} />

      <main className="mx-auto max-w-6xl px-5 py-12">
        <header className="mb-12 animate-rise border-b border-ink/10 pb-10">
          <p className="eyebrow mb-4">Relatório diário · por operador e campanha</p>
          <h1 className="font-serif text-6xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Relatório do
            <br />
            <span className="italic text-accent">Operador</span>
          </h1>
          <p className="mt-5 max-w-xl text-ink-muted">
            Selecione o operador, a campanha e o dia para ver o desempenho e comparar com as outras campanhas.
          </p>
        </header>

        <section className="print:hidden mb-10 grid grid-cols-1 gap-4 rounded-3xl border border-ink/5 bg-paper p-7 shadow-card sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">
              Data {loading && <Loader2 size={12} className="ml-1 inline animate-spin" />}
            </label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">Operador</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            >
              <option value="">Selecione o operador...</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">Campanha</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            >
              <option value="">Selecione a campanha...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {!showReport && (
          <div className="rounded-3xl border border-ink/5 bg-paper p-12 text-center shadow-card">
            <p className="text-ink-muted">Selecione o operador e a campanha acima para gerar o relatório do dia.</p>
          </div>
        )}

        {showReport && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <div>
                <p className="eyebrow mb-2">Relatório diário</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">
                  {selectedOperator?.name} <span className="text-ink-muted">—</span>{" "}
                  <span className="italic text-accent">{selectedCampaign?.name}</span>
                </h2>
                <p className="mt-1 text-ink-muted">{formatFullDate(date)}</p>
                {rank !== null && campaigns.length > 1 && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                    <Trophy size={14} />
                    {rankLabel(rank)} em interessados, entre {campaigns.length} campanhas
                  </span>
                )}
              </div>
              <button
                onClick={() => window.print()}
                className="print:hidden flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover"
              >
                <Printer size={16} />
                Exportar / Imprimir
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<PhoneOutgoing size={18} />} label="Ligações no dia" value={metrics.total} />
              <StatCard icon={<PhoneForwarded size={18} />} label="Transferidas" value={metrics.transferred} tone="text-go" />
              <StatCard icon={<Voicemail size={18} />} label="Caixa postal" value={metrics.voicemail} tone="text-orange-400" />
              <StatCard icon={<PhoneOff size={18} />} label="Sem sucesso" value={metrics.noAnswer} tone="text-ink-muted" />
              <StatCard icon={<Check size={18} />} label="Interessados" value={metrics.interested} tone="text-emerald-400" />
              <StatCard icon={<Square size={18} />} label="Retornar depois" value={metrics.callback} tone="text-amber-400" />
              <StatCard icon={<X size={18} />} label="Descartados" value={metrics.discarded} tone="text-accent" />
              <StatCard icon={<Percent size={18} />} label="Taxa de conversão" value={`${metrics.taxaConversao.toFixed(1)}%`} />
            </div>

            <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <h2 className="mb-1 font-serif text-2xl tracking-tight">
                {selectedCampaign?.name} vs. outras campanhas
              </h2>
              <p className="mb-6 text-sm text-ink-muted">Interessados no dia, todas as campanhas, todos os operadores</p>
              <CampaignComparisonChart
                bars={comparison.map((c) => ({
                  label: c.campaignName,
                  value: c.interested,
                  highlight: c.campaignId === campaignId,
                }))}
              />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "text-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink/5 bg-paper p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardhover">
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-500 ease-out group-hover:scale-x-100" />
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 ${tone}`}>
          {icon}
        </span>
        <p className={`font-serif text-3xl font-semibold leading-none tabular-nums ${tone}`}>{value}</p>
      </div>
      <p className="mt-4 text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">{label}</p>
    </div>
  );
}
