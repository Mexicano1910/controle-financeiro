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
    sb.from('casa_membros').select('user_id, casa_id'),
  ]);
  if (c.error || p.error || m.error) return res.status(500).json({ erro: (c.error || p.error || m.error).message });

  const porUsuario = {};
  for (const conta of c.data) {
    const quando = conta.vencimento < hoje ? `VENCIDA em ${fmt(conta.vencimento)}` : conta.vencimento === hoje ? 'vence HOJE' : `vence ${fmt(conta.vencimento)}`;
    const linha = `${conta.descricao || conta.beneficiario} - R$ ${Number(conta.valor).toFixed(2).replace('.', ',')} - ${quando}${conta.escopo === 'casa' ? ' (casa)' : ''}`;
    const destinos = conta.escopo === 'casa' ? m.data.filter(x => x.casa_id === conta.casa_id).map(x => x.user_id) : [conta.dono_id];
    for (const u of destinos) (porUsuario[u] ||= []).push(linha);
  }

  const envios = p.data.filter(x => x.ntfy_topic && porUsuario[x.id]).map(perfil =>
    fetch(`https://ntfy.sh/${encodeURIComponent(perfil.ntfy_topic)}`, {
      method: 'POST',
      headers: { Title: 'METHRA - contas a vencer', Priority: 'high' },
      body: porUsuario[perfil.id].join('\n') + '\n\nJa pagou? Envie o comprovante no app para dar baixa.',
    }).catch(() => null));
  await Promise.all(envios);
  res.status(200).json({ ok: true, enviados: envios.length });
}
