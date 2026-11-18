# Methra (Casa + Pessoal)

Site gratuito para controlar as contas: cada pessoa tem sua área **pessoal** (privada) e existe a área **Casa** compartilhada.
Stack 100% no plano grátis: **Supabase** (banco + login), **Vercel** (site + avisos diários), **ntfy** (notificações no celular).

## Como funciona

- ＋ → **Enviar PDF**: lê o boleto/conta no próprio navegador (valor, vencimento, quem recebe) e pergunta **Casa ou Pessoal**.
- Se o PDF for um **comprovante**, ele procura a conta pendente com o mesmo valor e dá baixa (ou lança como gasto já pago).
- O app **aprende**: depois que você classifica "Sabesp" como Casa/Água, nas próximas já vem preenchido.
- **Painel**: gráficos por categoria, últimos 6 meses, metas, assistente e **acerto do mês** (quem paga tudo × quanto o outro deve).
- **Exportar** gera CSV para abrir no Google Planilhas.
- Todo dia 8h (Brasília) a Vercel avisa pelo ntfy as contas que vencem em até 2 dias e as vencidas.

## Passo a passo

1. **Supabase** (supabase.com, grátis, sem cartão): crie um projeto.
2. No **SQL Editor**, cole e rode o _Passo 1_ de `supabase/schema.sql`.
3. Em **Authentication → Users → Add user**, crie os 2 usuários (e-mail + senha, marque "Auto Confirm"). Depois desative o cadastro público (Authentication → Sign In / Providers → desligar "Allow new users to sign up").
4. No SQL Editor, rode o _Passo 2_ (descomente e troque pelos e-mails de vocês).
5. Local: `npm install`, copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API). `npm run dev`.
6. Suba para o **GitHub** e importe na **Vercel**. Em _Environment Variables_ coloque as 4 variáveis do `.env.example` (a `SUPABASE_SERVICE_ROLE_KEY` fica só na Vercel, nunca no GitHub).
7. Em ⚙️ **Ajustes**, cada um clica em _Gerar_ no tópico, instala o app **ntfy** e assina esse tópico.

## Observações

- Os PDFs **não são guardados**: só os dados extraídos. Isso mantém tudo no limite grátis.
- Se o app errar um campo, é só corrigir antes de salvar. Boletos de bancos/concessionárias diferentes variam; a leitura é uma ajuda, você confirma.
- O plano grátis do Supabase pausa o projeto após 7 dias sem uso; o aviso diário da Vercel faz uma consulta por dia, o que deve evitar isso.
