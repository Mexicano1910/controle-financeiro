import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import Login, { NovaSenha } from './Login.jsx';
import Contas from './Contas.jsx';
import Painel from './Painel.jsx';
import Novo from './Novo.jsx';
import Ajustes from './Ajustes.jsx';
import SemCasa from './SemCasa.jsx';
import Laterais from './Laterais.jsx';
import { CATEGORIAS } from './lib/regras.js';

// Link de convite (?convite=CODIGO): guarda o código para usar depois do cadastro/login
const codigoDoLink = new URLSearchParams(location.search).get('convite');
if (codigoDoLink) {
  localStorage.setItem('convite', codigoDoLink.toUpperCase());
  history.replaceState({}, '', location.pathname);
}

export default function App() {
  const [sessao, setSessao] = useState(undefined);
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessao === undefined) return <p className="centro">Carregando…</p>;
  if (recuperando) return <NovaSenha onFim={() => setRecuperando(false)} />;
  return sessao ? <Principal user={sessao.user} /> : <Login />;
}

function Principal({ user }) {
  const [d, setD] = useState(null);
  const [aba, setAba] = useState('casa');
  const [sub, setSub] = useState('contas');
  const [novo, setNovo] = useState(null);
  const [aviso, setAviso] = useState('');
  const primeira = useRef(true);

  const carregar = useCallback(async () => {
    const q = t => supabase.from(t).select('*');
    const r = await Promise.all([q('perfis'), q('casa_membros'), supabase.from('casas').select('*').maybeSingle(), q('contas').order('vencimento'), q('regras'), q('acerto_pagamentos'), q('convites')]);
    const erro = r.find((x, i) => x.error && i !== 5); // a tabela de pagamentos do acerto é opcional até rodar a migração
    if (erro) { setD({ erro: erro.error.message }); return null; }
    const [p, m, casa, c, rg, a, cv] = r;
    const dados = {
      perfis: p.data, perfil: p.data.find(x => x.id === user.id) || { id: user.id }, membros: m.data,
      config: casa.data, temCasa: !!casa.data, contas: c.data, regras: rg.data, pagamentos: a.error ? [] : a.data,
      convites: cv.data.filter(x => !x.usado && new Date(x.expira_em) > new Date()),
    };
    setD(dados);
    if (primeira.current) { primeira.current = false; if (!dados.temCasa) setAba('pessoal'); }
    return dados;
  }, [user.id]);

  useEffect(() => {
    (async () => {
      const dados = await carregar();
      const codigo = localStorage.getItem('convite');
      if (!codigo || !dados) return;
      localStorage.removeItem('convite');
      if (dados.temCasa) return setAviso('Você já faz parte de uma casa, então o convite não foi usado.');
      const { error } = await supabase.rpc('entrar_na_casa', { p_codigo: codigo });
      if (error) setAviso(error.message);
      else { setAba('casa'); await carregar(); }
    })();
    const f = () => document.visibilityState === 'visible' && carregar(); // atualiza ao voltar para o app
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [carregar]);

  if (!d) return <p className="centro">Carregando…</p>;
  if (d.erro) return <p className="centro">Erro: {d.erro}</p>;
  const escopo = aba === 'ajustes' ? 'pessoal' : aba;
  const semCasa = aba === 'casa' && !d.temCasa;
  const casaId = d.config?.id;
  const extras = [...new Set([...Object.keys(d.perfil.metas || {}), ...Object.keys(d.config?.metas || {})])].filter(c => !CATEGORIAS.includes(c));

  return (
    <>
    <Laterais />
    <div className="app">
      <header className="marca"><img src="/icon-192.png" alt="" /><b>METHRA</b></header>
      <nav className="topo">
        <button className={aba === 'casa' ? 'on' : ''} onClick={() => setAba('casa')}>🏠 Casa</button>
        <button className={aba === 'pessoal' ? 'on' : ''} onClick={() => setAba('pessoal')}>👤 Meu pessoal</button>
        <button className={aba === 'ajustes' ? 'on' : ''} onClick={() => setAba('ajustes')}>⚙️</button>
      </nav>
      {aviso && <p className="aviso" onClick={() => setAviso('')}>{aviso} ✕</p>}
      {aba === 'ajustes' && <Ajustes user={user} d={d} reload={carregar} />}
      {semCasa && <SemCasa reload={carregar} />}
      {!semCasa && aba !== 'ajustes' && (
        <>
          <nav className="sub">
            <button className={sub === 'contas' ? 'on' : ''} onClick={() => setSub('contas')}>Contas</button>
            <button className={sub === 'painel' ? 'on' : ''} onClick={() => setSub('painel')}>Painel</button>
          </nav>
          {sub === 'contas'
            ? <Contas escopo={escopo} casaId={casaId} contas={d.contas} user={user} onEditar={c => setNovo({ conta: c })} reload={carregar} />
            : <Painel escopo={escopo} user={user} contas={d.contas} perfil={d.perfil} perfis={d.perfis} membros={d.membros} config={d.config} pagamentos={d.pagamentos} reload={carregar} />}
          <button className="fab" onClick={() => setNovo({})}>＋</button>
        </>
      )}
      {novo && (
        <Novo user={user} temCasa={d.temCasa} casaId={casaId} extras={extras} contas={d.contas} regras={d.regras} escopo={escopo} conta={novo.conta}
          onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); carregar(); }} />
      )}
    </div>
    </>
  );
}
