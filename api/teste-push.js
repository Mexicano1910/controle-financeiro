// Botão "Enviar teste" em Ajustes: manda uma notificação para os aparelhos da própria pessoa.
import { createClient } from '@supabase/supabase-js';
import { prepararPush, enviarPush } from '../servidor/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VITE_VAPID_PUBLIC_KEY) {
    return res.status(500).json({ erro: 'Chaves de avisos não configuradas na Vercel (VAPID).' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ erro: 'Sessão inválida. Entre de novo.' });

  prepararPush();
  const { data: inscricoes } = await sb.from('push_inscricoes').select('*').eq('user_id', data.user.id);
  let enviados = 0;
  for (const insc of inscricoes || []) {
    if (await enviarPush(sb, insc, { title: 'METHRA · teste', body: 'Deu certo! Os avisos de vencimento vão chegar assim. 🔔', url: '/', tag: 'methra-teste' })) enviados++;
  }
  res.status(200).json({ ok: true, enviados });
}
