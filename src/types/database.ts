// Tipos do banco de dados (espelham o schema.sql do Supabase)

export type LeadStatus =
  | "pending"
  | "queued"
  | "calling"
  | "human_answered"
  | "transferred"
  | "voicemail"
  | "no_answer"
  | "failed"
  | "completed";

export type OperatorStatus = "available" | "busy" | "offline";

// Desfecho que o operador marca após falar com o cliente
export type LeadOutcome = "interested" | "callback" | "discarded";

export interface Operator {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  extension: string | null; // ramal da API4Com (ex.: "1000")
  status: OperatorStatus; // intenção do usuário: available | busy(pausado) | offline
  on_call: boolean; // controlado pelo sistema: true enquanto está numa ligação
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: "draft" | "running" | "paused" | "finished";
  total_leads: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  campaign_id: string;
  company_name: string | null;
  phone: string;
  status: LeadStatus;
  provider_call_id: string | null; // id de cancelamento retornado pela API4Com
  answered_by: string | null;
  operator_id: string | null;
  record_url: string | null; // URL da gravação da chamada (API4Com)
  outcome: LeadOutcome | null; // desfecho marcado pelo operador
  outcome_at: string | null;
  notes: string | null; // observação livre do operador (ex.: "ligar dia 20")
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
