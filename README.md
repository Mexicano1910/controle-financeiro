# METHRA · inteligência financeira (Casa + Pessoal)

Site gratuito para controlar as contas: cada pessoa tem sua área **pessoal** (privada) e existe a área **Casa** compartilhada.
Stack 100% no plano grátis: **Supabase** (banco + login), **Vercel** (site + avisos diários), **avisos push** (notificações no celular e no computador).

## Como funciona
- ＋ → **Enviar PDF**: lê o boleto/conta no próprio navegador (valor, vencimento, quem recebe) e pergunta **Casa ou Pessoal**.
- Se o PDF for um **comprovante**, ele procura a conta pendente com o mesmo valor e dá baixa (ou lança como gasto já pago).
- O app **aprende**: depois que você classifica "Sabesp" como Casa/Água, nas próximas já vem preenchido.
- **Painel**: gráficos por categoria, últimos 6 meses, metas, assistente e **acerto do mês** (quem paga tudo × quanto o outro deve).
- **Exportar** gera CSV para abrir no Google Planilhas.
- Todo dia 8h (Brasília) a Vercel manda uma notificação com as contas que vencem em até 2 dias e as vencidas (⚙️ Ajustes → Ativar avisos, em cada aparelho).

## Passo a passo
1. **Supabase** (supabase.com, grátis, sem cartão): crie um projeto.
2. No **SQL Editor**, cole e rode o *Passo 1* de `supabase/schema.sql`.
3. Em **Authentication → Users → Add user**, crie os 2 usuários (e-mail + senha, marque "Auto Confirm"). Depois desative o cadastro público (Authentication → Sign In / Providers → desligar "Allow new users to sign up").
4. No SQL Editor, rode o *Passo 2* (descomente e troque pelos e-mails de vocês).
5. Local: `npm install`, copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API). `npm run dev`.
6. Suba para o **GitHub** e importe na **Vercel**. Em *Environment Variables* coloque as 4 variáveis do `.env.example` (a `SUPABASE_SERVICE_ROLE_KEY` fica só na Vercel, nunca no GitHub).
7. Em ⚙️ **Ajustes → Avisos de vencimento**, cada um toca em **Ativar avisos** em cada aparelho que usa (veja a seção "Avisos por notificação").

## Observações
- Os PDFs **não são guardados**: só os dados extraídos. Isso mantém tudo no limite grátis.
- Se o app errar um campo, é só corrigir antes de salvar. Boletos de bancos/concessionárias diferentes variam; a leitura é uma ajuda, você confirma.
- O plano grátis do Supabase pausa o projeto após 7 dias sem uso; o aviso diário da Vercel faz uma consulta por dia, o que deve evitar isso.

## Vários usuários (cadastro aberto)
- Qualquer pessoa pode criar conta na tela de login. **Cada conta é totalmente separada**: o banco só devolve a cada pessoa o que é dela.
- **Casa**: quem cria a casa vira "dono(a)" e, em ⚙️ Ajustes, gera **convites** (link de 7 dias, uso único) para chamar outras pessoas. Quem recebe o link cria a conta e já entra na casa.
- O dono pode **remover** moradores; qualquer morador pode **sair**. Quem sai fica só com as contas pessoais.
- Cada pessoa participa de **uma** casa por vez.
- Esqueci a senha: link por e-mail (precisa configurar a "Site URL" no Supabase, veja abaixo).

### Atualizando um projeto que já estava no ar
1. Faça um backup: em cada aba, botão **Exportar**.
2. No Supabase (SQL Editor), rode **uma vez** o arquivo `supabase/migracao-multiusuario.sql`.
3. Logo em seguida, suba o código novo no GitHub (a Vercel publica sozinha). Entre o SQL e o deploy o site pode dar erro por 1 ou 2 minutos.
4. Supabase → Authentication → **Sign In / Providers**: deixe o cadastro de novos usuários **ligado** e desligue **Confirm email** (o envio de e-mail do plano grátis é muito limitado).
5. Supabase → Authentication → **URL Configuration**: em **Site URL** coloque o endereço do seu site na Vercel.

## Novidades desta versão
- **Acerto do mês com pagamentos**: registre quanto cada pessoa já pagou; o "deve" diminui sozinho (precisa rodar `supabase/migracao-acerto-pagamentos.sql` uma vez).
- **Assistente**: no painel pessoal soma as contas pessoais + a sua parte da casa (a % do acerto), mostra % da renda gasta, quanto sobrou e se o mês está no vermelho; lista o que subiu/diminuiu em relação ao mês anterior e onde dá para economizar (só contas variáveis).
- **Categorias e metas**: botão **＋ Incluir** cria meta mesmo sem conta lançada, inclusive em categorias novas (que passam a aparecer ao lançar uma conta).
- **Identidade visual CODECOR TECH** (preto, cinza, dourado âmbar, cobre). Verde/amarelo/vermelho continuam só para o status das contas. Cores em `src/styles.css`, bloco `:root`.
- **Logo da CODECOR TECH** nas laterais em telas largas (`public/logo-lateral.png`).
- Nome do app: **METHRA** (inteligência).

## Avisos por notificação (push)
- Substitui o ntfy. Rode `supabase/migracao-avisos-push.sql` uma vez e gere as chaves com `npx web-push generate-vapid-keys`.
- Variáveis: `VITE_VAPID_PUBLIC_KEY` (pública; `.env.local` e Vercel), `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (só Vercel).
- O botão **Enviar teste** só funciona no site publicado. No iPhone precisa do app instalado na tela inicial (iOS 16.4+).
