import { useState } from 'react';
import { supabase } from './supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  async function entrar(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro('E-mail ou senha incorretos.');
  }
  return (
    <form className="login card" onSubmit={entrar}>
      <h1>💰 Controle Financeiro</h1>
      <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
      {erro && <p className="erro">{erro}</p>}
      <button className="prim">Entrar</button>
    </form>
  );
}
