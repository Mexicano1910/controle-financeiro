// Roda 1x por dia na Vercel (cron). Também mantém o Supabase "ativo" (evita a pausa do plano grátis).
import { createClient } from '@supabase/supabase-js';

const fmt = d => d.split('-').reverse().slice(0, 2).join('/');

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const lim = new Date(Date.parse(hoje + 'T00:00:00Z') + 2 * 864e5).toISOString().slice(0, 10);

  const [c, p, m] = await Promise.all([
    sb.from('contas').select('*').eq('status', 'pendente').lte('vencimento', lim),
    sb.from('perfis').select('id, ntfy_topic'),
    sb.from('casa_membros').select('user_id'),
  ]);
  if (c.error || p.error || m.error) return res.status(500).json({ erro: (c.error || p.error || m.error).message });

  const membros = m.data.map(x => x.user_id);
  const porUsuario = {};
  for (const conta of c.data) {
    const quando = conta.vencimento < hoje ? `VENCIDA em ${fmt(conta.vencimento)}` : conta.vencimento === hoje ? 'vence HOJE' : `vence ${fmt(conta.vencimento)}`;
    const linha = `${conta.descricao || conta.beneficiario} - R$ ${Number(conta.valor).toFixed(2).replace('.', ',')} - ${quando}${conta.escopo === 'casa' ? ' (casa)' : ''}`;
    for (const u of conta.escopo === 'casa' ? membros : [conta.dono_id]) (porUsuario[u] ||= []).push(linha);
  }

  let enviados = 0;
  for (const perfil of p.data) {
    const linhas = porUsuario[perfil.id];
    if (!linhas || !perfil.ntfy_topic) continue;
    await fetch(`https://ntfy.sh/${encodeURIComponent(perfil.ntfy_topic)}`, {
      method: 'POST',
      headers: { Title: 'Contas a vencer', Priority: 'high' },
      body: linhas.join('\n') + '\n\nJa pagou? Envie o comprovante no app para dar baixa.',
    });
    enviados++;
  }
  res.status(200).json({ ok: true, enviados });
}
