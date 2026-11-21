import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const CHAVE = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function chaveEmBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function Avisos({ user }) {
  const suporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [ativo, setAtivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!suporte) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(s => setAtivo(!!s && Notification.permission === 'granted'))
      .catch(() => {});
  }, [suporte]);

  async function ativar() {
    setOcupado(true); setMsg('');
    try {
      if (!CHAVE) throw new Error('Chave de avisos não configurada (VITE_VAPID_PUBLIC_KEY). Veja o passo a passo.');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações deste site nas configurações do navegador e tente de novo.');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE) });
      const j = sub.toJSON();
      const { error } = await supabase.rpc('registrar_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: navigator.userAgent.slice(0, 150) });
      if (error) throw error;
      setAtivo(true); setMsg('Avisos ativados neste aparelho ✔');
    } catch (e) { setMsg(e.message || String(e)); }
    setOcupado(false);
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await supabase.from('push_inscricoes').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
      setAtivo(false); setMsg('Avisos desativados neste aparelho.');
    } catch (e) { setMsg(e.message || String(e)); }
    setOcupado(false);
  }

  async function testar() {
    setMsg('Enviando teste…');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/teste-push', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!(r.headers.get('content-type') || '').includes('json')) return setMsg('O teste só funciona no site publicado (Vercel), não no localhost.');
      const j = await r.json();
      setMsg(!r.ok ? j.erro || 'Falha ao enviar o teste.' : j.enviados ? 'Teste enviado! Em instantes deve aparecer uma notificação.' : 'Nenhum aparelho ativado para esta conta. Toque em "Ativar avisos".');
    } catch (e) { setMsg(e.message || String(e)); }
  }

  return (
    <div className="card">
      <h3>Avisos de vencimento</h3>
      <small>Uma notificação todo dia às 8h com as contas que vencem em até 2 dias e as vencidas. Ative em cada aparelho que você usa.</small>
      {!suporte && <p className="aviso">Este navegador não permite avisos. No iPhone, adicione o METHRA à tela inicial (Compartilhar → Adicionar à Tela de Início) e abra o app por lá.</p>}
      {suporte && (ativo ? (
        <>
          <p className="ok">✅ Avisos ativos neste aparelho</p>
          <div className="dois"><button onClick={testar}>Enviar teste</button><button disabled={ocupado} onClick={desativar}>Desativar</button></div>
        </>
      ) : <button className="prim" disabled={ocupado} onClick={ativar}>🔔 Ativar avisos neste aparelho</button>)}
      {msg && <p className="aviso">{msg}</p>}
    </div>
  );
}
