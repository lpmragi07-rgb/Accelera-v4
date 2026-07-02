# LigarAut — Auto Dialer (Next.js + Supabase + API4Com)

Discador automático que disca leads de um CSV e conecta o operador (por ramal)
apenas quando há atendimento, usando a **detecção de caixa postal da API4Com**
para evitar desperdício com secretárias eletrônicas.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Auth + Postgres com RLS rígido)
- **API4Com** (telefonia/voz nacional + detecção de caixa postal)
- **Tailwind CSS** + **lucide-react**
- **Vercel Analytics** + **Speed Insights**

## 1. Pré-requisitos externos

### API4Com
1. Crie a conta e configure os **ramais** dos operadores (ex.: `1000`).
2. Gere um **token de API** (Authorization). Veja a doc de autenticação.
3. Cadastre o **webhook** apontando para `APP_BASE_URL/api/api4com/events?secret=SEU_SEGREDO`
   com os eventos `channel-answer` e `channel-hangup` (via `PATCH /integrations`).
4. Confirme com o suporte que a **detecção de caixa postal** está ativa no seu plano.

### Supabase
1. Crie um projeto.
2. Rode `supabase/schema.sql` no **SQL Editor** (instalação nova).
   Se já rodou o schema antigo (Twilio), rode `supabase/migration_api4com.sql`.
3. Pegue: `Project URL`, `anon key` e `service_role key`.

### Túnel (desenvolvimento local)
A API4Com precisa alcançar o webhook. Use o ngrok:

```bash
ngrok http 3000
```

Copie a URL pública para `APP_BASE_URL`.

## 2. Configuração

```bash
cp .env.local.example .env.local
# preencha as variáveis
npm install
npm run dev
```

## 3. Como funciona o fluxo

Modelo **progressivo** (1 chamada por operador disponível):

1. `POST /api/dialer/start` busca operadores `available` (com ramal) e pareia
   cada um com um lead `pending`.
2. Para cada par, chama `POST /dialer` da API4Com (`extension` = ramal do
   operador, `phone` = lead, `metadata.leadId` = id do lead).
3. A API4Com liga; a detecção de caixa postal evita conectar o operador a
   máquinas.
4. Webhook `POST /api/api4com/events`:
   - `channel-answer` → lead vira **Humano atendeu**.
   - `channel-hangup` → **Transferido** (se houve atendimento e duração) ou
     **Não atendeu**; grava `record_url` e libera o operador.

## 4. Segurança (RLS)

- Frontend e rotas autenticadas usam a **anon key** → RLS garante que cada
  usuário só acessa seus próprios dados.
- O webhook da API4Com usa a **service_role key** no servidor e é protegido por
  um **segredo na URL** (`?secret=`), já que a API4Com não assina os webhooks.

## 5. Formato do CSV

Cabeçalhos aceitos (case-insensitive):
- Empresa: `empresa`, `company`, `company_name`, `nome`, `name`, `razao_social`
- Telefone: `telefone`, `phone`, `celular`, `number`, `fone`, `contato`

Exemplo em `exemplo-leads.csv`.
