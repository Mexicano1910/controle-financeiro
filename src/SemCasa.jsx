import { useState } from 'react';
import { supabase } from './supabase.js';

export default function SemCasa({ reload }) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState('');
  async function acao(fn, args) {
    const { error } = await supabase.rpc(fn, args);
    if (error) setMsg(error.message); else reload();
  }
  return (
    <div>
      <div className="card">
        <h3>Criar uma casa</h3>
        <p>Para dividir as contas com outra pessoa (cônjuge, família, quem mora com você). O que é pessoal continua só seu.</p>
        <input placeholder="Nome da casa (ex.: Nossa casa)" value={nome} onChange={e => setNome(e.target.value)} />
        <button className="prim" onClick={() => acao('criar_casa', { p_nome: nome })}>Criar casa</button>
      </div>
      <div className="card">
        <h3>Entrar numa casa</h3>
        <p>Recebeu um código de convite?</p>
        <input placeholder="Código do convite" value={codigo} onChange={e => setCodigo(e.target.value)} />
        <button onClick={() => acao('entrar_na_casa', { p_codigo: codigo })}>Entrar</button>
      </div>
      {msg && <p className="erro">{msg}</p>}
    </div>
  );
}
