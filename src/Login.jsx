import { useState } from 'react';
import { supabase } from './supabase.js';
import Laterais from './Laterais.jsx';

export default function Login() {
  const convidado = !!localStorage.getItem('convite');
  const [modo, setModo] = useState(convidado ? 'criar' : 'entrar'); // entrar | criar | esqueci
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setMsg('');
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg('E-mail ou senha incorretos.');
    } else if (modo === 'criar') {
      const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome: nome.trim() } } });
      if (error) return setMsg(error.message.toLowerCase().includes('already') ? 'Este e-mail já tem cadastro. Use "Entrar".' : error.message);
      if (!data.session) setMsg('Quase lá! Enviamos um e-mail para você confirmar o cadastro.');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      setMsg(error ? error.message : 'Se este e-mail tiver cadastro, você vai receber um link para criar uma nova senha.');
    }
  }

  return (
    <>
    <Laterais />
    <form className="login card" onSubmit={enviar}>
      <img className="logo-login" src="/icon-192.png" alt="" />
      <h1 className="marca-titulo">METHRA</h1>
      <small className="centro-txt">Inteligência financeira</small>
      {convidado && <p className="aviso">Você foi convidado(a) para uma casa. Crie sua conta (ou entre) para aceitar.</p>}
      {modo === 'criar' && <input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} required />}
      <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
      {modo !== 'esqueci' && <input type="password" placeholder="Senha (mín. 6 caracteres)" minLength={6} value={senha} onChange={e => setSenha(e.target.value)} required />}
      {msg && <p className={msg.startsWith('Quase') || msg.startsWith('Se este') ? 'aviso' : 'erro'}>{msg}</p>}
      <button className="prim">{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
      {modo !== 'entrar' && <button type="button" onClick={() => { setModo('entrar'); setMsg(''); }}>Já tenho conta</button>}
      {modo !== 'criar' && <button type="button" onClick={() => { setModo('criar'); setMsg(''); }}>Criar conta</button>}
      {modo === 'entrar' && <button type="button" onClick={() => { setModo('esqueci'); setMsg(''); }}>Esqueci a senha</button>}
    </form>
    </>
  );
}

// Tela mostrada quando a pessoa abre o link de "esqueci a senha"
export function NovaSenha({ onFim }) {
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');
  async function salvar(e) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return setMsg(error.message);
    onFim();
  }
  return (
    <form className="login card" onSubmit={salvar}>
      <h1>Nova senha</h1>
      <input type="password" placeholder="Nova senha (mín. 6 caracteres)" minLength={6} value={senha} onChange={e => setSenha(e.target.value)} required />
      {msg && <p className="erro">{msg}</p>}
      <button className="prim">Salvar nova senha</button>
    </form>
  );
}
