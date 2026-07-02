"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Phone,
  PhoneOff,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import OutcomeButtons from "./OutcomeButtons";
import type { Lead, LeadOutcome } from "@/types/database";

interface LeadsTableProps {
  leads: Lead[];
  onSetOutcome: (leadId: string, outcome: LeadOutcome | null) => void;
  onCancelCall?: (leadId: string) => void;
}

// Quantos leads exibir por página (evita rolagem infinita em listas grandes).
const PAGE_SIZE = 20;

// Monta a sequência de abas com reticências: 1 … 4 5 [6] 7 8 … 432
function getPageItems(current: number, total: number): (number | "…")[] {
  const items: (number | "…")[] = [];
  const window = 1; // vizinhos exibidos de cada lado da página atual
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

// Indicador de ligação ao vivo exibido AO LADO DO NOME DA EMPRESA:
//  calling        -> bolinha amarela piscando + "Discando"
//  human_answered -> bolinha verde piscando + "Em ligação"
function LiveCallIndicator({ status }: { status: Lead["status"] }) {
  const calling = status === "calling";
  const color = calling ? "bg-amber-400" : "bg-emerald-400";
  const label = calling ? "Discando" : "Em ligação";
  const text = calling ? "text-amber-300" : "text-emerald-300";
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-80 ${color}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      <span className={`text-xs font-semibold ${text}`}>{label}</span>
    </span>
  );
}

export default function LeadsTable({
  leads,
  onSetOutcome,
  onCancelCall,
}: LeadsTableProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));

  const needsOperatorAttention = leads.some(
    (l) =>
      l.status === "calling" ||
      l.status === "human_answered" ||
      (!l.outcome &&
        ["no_answer", "transferred", "voicemail", "failed"].includes(l.status))
  );

  // Mantém no topo quem está em ligação ou aguardando qualificação (página 1).
  useEffect(() => {
    if (needsOperatorAttention && page !== 1) setPage(1);
  }, [needsOperatorAttention, page]);

  // Se a lista encolher (ex.: troca de campanha), volta para uma página válida.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return leads.slice(start, start + PAGE_SIZE);
  }, [leads, page]);

  if (leads.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-ink-muted">
        Nenhum lead nesta campanha ainda. Importe um CSV para começar.
      </p>
    );
  }

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, leads.length);
  const pageItems = getPageItems(page, totalPages);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/5 text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-6 py-3 font-medium">Empresa</th>
            <th className="px-6 py-3 font-medium">Telefone</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Qualificação</th>
          </tr>
        </thead>
        <tbody>
          {pageLeads.map((lead) => {
            const discarded = lead.outcome === "discarded";
            const live =
              lead.status === "calling" || lead.status === "human_answered";
            const needsQualification =
              !lead.outcome &&
              ["no_answer", "transferred", "voicemail", "failed"].includes(
                lead.status
              );
            const rowTone = live
              ? lead.status === "human_answered"
                ? "bg-emerald-500/5"
                : "bg-amber-500/5"
              : needsQualification
              ? "bg-accent/5"
              : "";
            return (
              <tr
                key={lead.id}
                className={`border-b border-ink/5 transition-colors hover:bg-ink/5 ${
                  discarded ? "opacity-50" : ""
                } ${rowTone}`}
              >
                <td className="px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Building2 size={15} className="shrink-0 text-ink-muted" />
                    <span
                      className={`font-medium ${
                        discarded ? "line-through" : ""
                      }`}
                    >
                      {lead.company_name || "—"}
                    </span>
                    {/* Indicador ao vivo bem ao lado do nome da empresa */}
                    {live && <LiveCallIndicator status={lead.status} />}
                    {needsQualification && !live && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                        Qualificar
                      </span>
                    )}
                    {live && onCancelCall && (
                      <button
                        onClick={() => onCancelCall(lead.id)}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent hover:text-white"
                        title="Parar esta ligação imediatamente"
                      >
                        <PhoneOff size={12} />
                        Parar
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Phone size={14} />
                    {lead.phone}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-6 py-3">
                  <OutcomeButtons
                    current={lead.outcome}
                    onSet={(outcome) => onSetOutcome(lead.id, outcome)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Rodapé de paginação: "Mostrando X–Y de Z" + abas numeradas */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-ink/5 px-6 py-4 sm:flex-row">
        <p className="text-xs text-ink-muted">
          Mostrando{" "}
          <span className="font-semibold text-ink">
            {from}–{to}
          </span>{" "}
          de <span className="font-semibold text-ink">{leads.length}</span> leads
        </p>

        {totalPages > 1 && (
          <nav className="flex items-center gap-1.5" aria-label="Paginação">
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
                <span
                  key={`gap-${i}`}
                  className="px-1.5 text-sm text-ink-muted"
                >
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
      </div>
    </div>
  );
}
