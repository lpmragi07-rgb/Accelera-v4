"use client";

import { Check, X, Square } from "lucide-react";
import type { LeadOutcome } from "@/types/database";

interface OutcomeButtonsProps {
  current: LeadOutcome | null;
  // Passa null quando o operador clica no botão já selecionado (desfaz a escolha)
  onSet: (outcome: LeadOutcome | null) => void;
  size?: number;
}

// Alterna a escolha: se já está selecionada, retorna null (remove); senão seleciona.
function toggle(current: LeadOutcome | null, value: LeadOutcome): LeadOutcome | null {
  return current === value ? null : value;
}

// Três ações de qualificação que o operador usa após falar com o cliente.
// Verde = interessado | Amarelo = retornar depois | Vermelho = descartar.
export default function OutcomeButtons({ current, onSet, size = 16 }: OutcomeButtonsProps) {
  const base =
    "flex items-center justify-center rounded-lg border p-1.5 transition";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title="Cliente aceitou — contatar depois (clique de novo para desfazer)"
        aria-label="Aceitou"
        onClick={() => onSet(toggle(current, "interested"))}
        className={`${base} ${
          current === "interested"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15"
        }`}
      >
        <Check size={size} />
      </button>

      <button
        type="button"
        title="Não atendeu ou vai pensar — ligar novamente depois (clique de novo para desfazer)"
        aria-label="Retornar depois"
        onClick={() => onSet(toggle(current, "callback"))}
        className={`${base} ${
          current === "callback"
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-amber-500/40 text-amber-400 hover:bg-amber-500/15"
        }`}
      >
        <Square size={size} fill="currentColor" />
      </button>

      <button
        type="button"
        title="Cliente recusou — descartar (clique de novo para desfazer)"
        aria-label="Recusou"
        onClick={() => onSet(toggle(current, "discarded"))}
        className={`${base} ${
          current === "discarded"
            ? "border-red-500 bg-red-500 text-white"
            : "border-red-500/40 text-red-400 hover:bg-red-500/15"
        }`}
      >
        <X size={size} />
      </button>
    </div>
  );
}
