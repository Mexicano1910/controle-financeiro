import { useState } from 'react';
import { supabase } from './supabase.js';
import { num } from './lib/util.js';

export default function Ajustes({ user, d, reload }) {
  const { perfil, perfis, config, temCasa } = d;
  const [nome, setNome] = useState(perfil.nome || '');
  const [topic, setTopic] = useState(perfil.ntfy_topic || '');
  const [renda, setRenda] = useState(String(perfil.renda || '').replace('.', ','));
  const [pagador, setPagador] = useState(config?.pagador || '');
  const [pct, setPct] = useState(config?.pct_pagador ?? 50);
  const [rendaCasa, setRendaCasa] = useState(String(config?.renda_casa || '').replace('.', ','));
  const [ok, setOk] = useState('');

  async function salvar(e) {
    e.preventDefault();
    await supabase.from('perfis').update({ nome, ntfy_topic: topic || null, renda: num(renda) || 0 }).eq('id', user.id);
    if (temCasa && config) await supabase.from('casa_config').update({ pagador: pagador || null, pct_pagador: Number(pct) || 50, renda_casa: num(rendaCasa) || 0 }).eq('id', 1);
    setOk('Salvo ✔'); reload();
  }

  return (
    <form className="card" onSubmit={salvar}>
      <h3>Meu perfil</h3>
      <input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} />
      <input inputMode="decimal" placeholder="Minha renda mensal (R$)" value={renda} onChange={e => setRenda(e.target.value)} />
      <h3>Avisos de vencimento</h3>
      <small>Instale o app gratuito <b>ntfy</b> (iPhone/Android) e assine o tópico abaixo. Os avisos chegam todo dia de manhã.</small>
      <div className="dois">
        <input placeholder="Tópico do ntfy" value={topic} onChange={e => setTopic(e.target.value)} />
        <button type="button" onClick={() => setTopic('fin-' + crypto.randomUUID().replace(/-/g, '').slice(0, 14))}>Gerar</button>
      </div>
      {temCasa && config && (
        <>
          <h3>Casa</h3>
          <input inputMode="decimal" placeholder="Renda mensal da casa (R$)" value={rendaCasa} onChange={e => setRendaCasa(e.target.value)} />
          <select value={pagador} onChange={e => setPagador(e.target.value)}>
            <option value="">Quem paga as contas da casa?</option>
            {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <label>Parte de quem paga: <b>{pct}%</b> (o outro divide o resto)
            <input type="range" min="0" max="100" step="5" value={pct} onChange={e => setPct(e.target.value)} />
          </label>
        </>
      )}
      <button className="prim">Salvar</button>
      {ok && <p className="aviso">{ok}</p>}
      <button type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
    </form>
  );
}
