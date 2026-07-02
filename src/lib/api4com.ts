// Cliente da API de voz da API4Com.
// Docs: https://developers.api4com.com
// Autenticação via header Authorization com o token da conta.

const API4COM_BASE_URL =
  process.env.API4COM_BASE_URL || "https://api.api4com.com/api/v1";

interface DoCallParams {
  extension: string; // ramal do operador que origina a chamada
  phone: string; // telefone do lead (destinatário), em E.164
  metadata?: Record<string, string | number>; // devolvido nos webhooks
}

interface DoCallResponse {
  id: string; // ATENÇÃO: este id serve apenas para cancelar a chamada
  message: string;
}

// Dispara uma chamada de voz. A API4Com liga conectando o ramal do operador
// ao telefone do lead. Os eventos reais (atendida/finalizada) chegam via webhook.
export async function doCall(params: DoCallParams): Promise<DoCallResponse> {
  const token = process.env.API4COM_TOKEN;
  if (!token) {
    throw new Error("API4COM_TOKEN não configurado no servidor.");
  }

  const res = await fetch(`${API4COM_BASE_URL}/dialer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify(params),
  });

  // Lê o corpo como texto primeiro para conseguir mostrar o motivo mesmo
  // quando a API4Com responde algo que não seja o JSON esperado.
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    // A API4Com pode devolver o motivo em "message", "error" ou "errors".
    const detail =
      (data.message as string) ||
      (data.error as string) ||
      (Array.isArray(data.errors)
        ? data.errors
            .map((e) =>
              typeof e === "string" ? e : (e as { message?: string })?.message
            )
            .filter(Boolean)
            .join("; ")
        : "") ||
      raw ||
      "";
    throw new Error(
      `Falha na API4Com (HTTP ${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  return data as unknown as DoCallResponse;
}

// Encerra/cancela uma chamada em andamento. Usa o id retornado pelo doCall
// (provider_call_id). Rota oficial: POST /calls/{id}/hangup.
export async function hangupCall(id: string): Promise<void> {
  const token = process.env.API4COM_TOKEN;
  if (!token) {
    throw new Error("API4COM_TOKEN não configurado no servidor.");
  }

  const res = await fetch(`${API4COM_BASE_URL}/calls/${id}/hangup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detail =
      (data.message as string) || (data.error as string) || raw || "";
    throw new Error(
      `Falha ao encerrar chamada (HTTP ${res.status})${
        detail ? `: ${detail}` : ""
      }`
    );
  }
}

// Estrutura do payload enviado pela API4Com nos webhooks (channel-answer/hangup)
export interface Api4ComWebhookEvent {
  version: string;
  eventType: "channel-answer" | "channel-hangup";
  id: string; // id correto da chamada
  domain: string;
  direction: "inbound" | "outbound";
  caller: string; // ramal que originou
  called: string; // telefone que recebeu
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration?: number;
  hangupCause?: string;
  hangupCauseCode?: string;
  recordUrl?: string;
  metadata?: Record<string, string | number>;
}
