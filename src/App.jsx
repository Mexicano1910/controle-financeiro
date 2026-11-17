import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import Login from './Login.jsx';
import Contas from './Contas.jsx';
import Painel from './Painel.jsx';
import Novo from './Novo.jsx';
import Ajustes from './Ajustes.jsx';

export default function App() {
  const [sessao, setSessao] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessao === undefined) return <p className="centro">Carregando…</p>;
  return sessao ? <Principal user={sessao.user} /> : <Login />;
}

function Principal({ user }) {
  const [d, setD] = useState(null);
  const [aba, setAba] = useState('casa');
  const [sub, setSub] = useState('contas');
  const [novo, setNovo] = useState(null);

  const carregar = useCallback(async () => {
    const q = t => supabase.from(t).select('*');
    const r = await Promise.all([q('perfis'), q('casa_membros'), supabase.from('casa_config').select('*').maybeSingle(), q('contas').order('vencimento'), q('regras'), q('acertos')]);
    const erro = r.find(x => x.error);
    if (erro) return setD({ erro: erro.error.message });
    const [p, m, cfg, c, rg, a] = r;
    const temCasa = m.data.some(x => x.user_id === user.id);
    setD({ perfis: p.data, perfil: p.data.find(x => x.id === user.id) || { id: user.id }, temCasa, config: cfg.data, contas: c.data, regras: rg.data, acertos: a.data });
    if (!temCasa) setAba(x => (x === 'casa' ? 'pessoal' : x));
  }, [user.id]);

  useEffect(() => {
    carregar();
    const f = () => document.visibilityState === 'visible' && carregar(); // atualiza ao voltar para o app
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [carregar]);

  if (!d) return <p className="centro">Carregando…</p>;
  if (d.erro) return <p className="centro">Erro: {d.erro}</p>;
  const escopo = aba === 'ajustes' ? 'pessoal' : aba;

  return (
    <div className="app">
      <nav className="topo">
        {d.temCasa && <button className={aba === 'casa' ? 'on' : ''} onClick={() => setAba('casa')}>🏠 Casa</button>}
        <button className={aba === 'pessoal' ? 'on' : ''} onClick={() => setAba('pessoal')}>👤 Meu pessoal</button>
        <button className={aba === 'ajustes' ? 'on' : ''} onClick={() => setAba('ajustes')}>⚙️</button>
      </nav>
      {aba !== 'ajustes' && (
        <nav className="sub">
          <button className={sub === 'contas' ? 'on' : ''} onClick={() => setSub('contas')}>Contas</button>
          <button className={sub === 'painel' ? 'on' : ''} onClick={() => setSub('painel')}>Painel</button>
        </nav>
      )}
      {aba === 'ajustes' && <Ajustes user={user} d={d} reload={carregar} />}
      {aba !== 'ajustes' && sub === 'contas' && <Contas escopo={escopo} contas={d.contas} user={user} onEditar={c => setNovo({ conta: c })} reload={carregar} />}
      {aba !== 'ajustes' && sub === 'painel' && <Painel escopo={escopo} contas={d.contas} perfil={d.perfil} perfis={d.perfis} config={d.config} acertos={d.acertos} reload={carregar} />}
      {aba !== 'ajustes' && <button className="fab" onClick={() => setNovo({})}>＋</button>}
      {novo && (
        <Novo user={user} temCasa={d.temCasa} contas={d.contas} regras={d.regras} escopo={escopo} conta={novo.conta}
          onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); carregar(); }} />
      )}
    </div>
  );
}
