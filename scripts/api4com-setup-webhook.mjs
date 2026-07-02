// ============================================================
// LIGARAUT — Configura o webhook da API4Com para receber TAMBÉM o
// evento "channel-answer" (chamada atendida), além de "channel-hangup".
//
// Sem isso, o painel só mostra "Discando" (amarelo) e nunca fica verde
// "Em ligação", porque a API4Com não avisa quando a chamada é atendida.
//
// Como rodar:
//   API4COM_TOKEN=...  API4COM_GATEWAY=ligaraut \
//   APP_BASE_URL=https://ligaraut.vercel.app \
//   API4COM_WEBHOOK_SECRET=...  node scripts/api4com-setup-webhook.mjs
// ============================================================

const BASE = process.env.API4COM_BASE_URL || "https://api.api4com.com/api/v1";
const TOKEN = process.env.API4COM_TOKEN;
const GATEWAY = process.env.API4COM_GATEWAY || "ligaraut";
const APP_BASE_URL = process.env.APP_BASE_URL;
const SECRET = process.env.API4COM_WEBHOOK_SECRET;

if (!TOKEN || !APP_BASE_URL || !SECRET) {
  console.error(
    "Faltam variáveis. Necessário: API4COM_TOKEN, APP_BASE_URL e API4COM_WEBHOOK_SECRET."
  );
  process.exit(1);
}

const webhookUrl = `${APP_BASE_URL}/api/api4com/events?secret=${SECRET}`;

const payload = {
  gateway: GATEWAY,
  webhook: true,
  webhookConstraint: { metadata: { gateway: GATEWAY } },
  metadata: {
    webhookUrl,
    webhookVersion: "v1.4",
    // O ponto-chave: inscrever os DOIS eventos
    webhookTypes: ["channel-answer", "channel-hangup"],
  },
};

const res = await fetch(`${BASE}/integrations`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: TOKEN },
  body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log("HTTP", res.status);
console.log(JSON.stringify(data, null, 2));

if (!res.ok) {
  console.error("Falha ao configurar o webhook.");
  process.exit(1);
}
console.log("\nOK! Webhook configurado para channel-answer + channel-hangup.");
