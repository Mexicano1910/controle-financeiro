import { useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from './supabase.js';
import { brl, hoje, num, somaMes } from './lib/util.js';
import { CATEGORIAS, FIXAS } from './lib/regras.js';

const CORES = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16', '#f97316', '#64748b'];

export default function Painel({ escopo, contas, perfil, perfis, config, acertos, reload }) {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const todas = contas.filter(c => c.escopo === escopo);
  const dm = m => todas.filter(c => c.vencimento.startsWith(m));
  const tot = a => a.reduce((s, c) => s + Number(c.valor), 0);
  const porCat = a => a.reduce((o, c) => { const k = c.categoria || 'Outros'; o[k] = (o[k] || 0) + Number(c.valor); return o; }, {});

  const atual = dm(mes), anterior = dm(somaMes(mes, -1));
  const cat = porCat(atual), catAnt = porCat(anterior);
  const total = tot(atual), totalAnt = tot(anterior);
  const dif = totalAnt ? Math.round(((total - totalAnt) / totalAnt) * 100) : null;
  const pizza = Object.entries(cat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const seis = [-5, -4, -3, -2, -1, 0].map(i => { const m = somaMes(mes, i); return { mes: m.slice(5) + '/' + m.slice(2, 4), total: tot(dm(m)) }; });

  const fonte = escopo === 'casa' ? config : perfil;
  const renda = Number(escopo === 'casa' ? config?.renda_casa : perfil?.renda) || 0;
  const metas = fonte?.metas || {};

  // Assistente (regras simples, sem IA paga)
  const dicas = [];
  if (!renda) dicas.push('Informe a renda em ⚙️ Ajustes para eu dizer se o mês está no vermelho.');
  else {
    const saldo = renda - total;
    dicas.push(saldo < 0 ? `🔴 Você está no vermelho: gastos passam da renda em ${brl(-saldo)}.` : `🟢 Sobram ${brl(saldo)} (${Math.round((saldo / renda) * 100)}% da renda) com os gastos lançados.`);
  }
  Object.entries(cat).filter(([k]) => !FIXAS.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .forEach(([k, v]) => dicas.push(`✂️ Dá para cortar em ${k} (${brl(v)}): reduzir 20% economiza ${brl(v * 0.2)}.`));
  const subiu = Object.entries(cat).map(([k, v]) => [k, v - (catAnt[k] || 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
  if (subiu) dicas.push(`📈 O que mais subiu: ${subiu[0]} (+${brl(subiu[1])} vs. mês anterior).`);

  async function salvarMeta(c, v) {
    const n = num(v), novas = { ...metas };
    if (n > 0) novas[c] = n; else delete novas[c];
    if (escopo === 'casa') await supabase.from('casa_config').update({ metas: novas }).eq('id', 1);
    else await supabase.from('perfis').update({ metas: novas }).eq('id', perfil.id);
    reload();
  }

  const pg = perfis.find(p => p.id === config?.pagador), outro = perfis.find(p => p.id !== config?.pagador);
  const pct = Number(config?.pct_pagador) || 50, deve = (total * (100 - pct)) / 100, ac = acertos.find(a => a.mes === mes);

  return (
    <section>
      <div className="linha">
        <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} />
        <div className="resumo"><b>{brl(total)}</b><small>{dif == null ? 'sem mês anterior' : `${dif > 0 ? '+' : ''}${dif}% vs. mês anterior`}</small></div>
      </div>

      {escopo === 'casa' && config && (
        <div className="card">
          <h3>Acerto do mês</h3>
          {pg && outro
            ? <p><b>{outro.nome}</b> deve <b>{brl(deve)}</b> a <b>{pg.nome}</b> ({100 - pct}% de {brl(total)}).</p>
            : <p>Defina quem paga as contas em ⚙️ Ajustes.</p>}
          <label className="chk"><input type="checkbox" checked={!!ac?.feito} onChange={async e => { await supabase.from('acertos').upsert({ mes, feito: e.target.checked }); reload(); }} /> Acerto feito</label>
        </div>
      )}

      <div className="card"><h3>Assistente</h3>{dicas.map((t, i) => <p key={i}>{t}</p>)}</div>

      <div className="card">
        <h3>Onde gastamos</h3>
        {pizza.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pizza} dataKey="value" nameKey="name" outerRadius={85} label={e => e.name}>
                {pizza.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
              <Tooltip formatter={v => brl(v)} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="vazio">Sem dados neste mês.</p>}
      </div>

      <div className="card">
        <h3>Últimos 6 meses</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={seis}><XAxis dataKey="mes" /><YAxis hide /><Tooltip formatter={v => brl(v)} /><Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Categorias e metas</h3>
        {CATEGORIAS.filter(c => cat[c] || metas[c]).map(c => {
          const v = cat[c] || 0, m = metas[c], p = m ? v / m : 0;
          return (
            <div key={c} className="cat">
              <div className="linha"><span>{c}</span><b>{brl(v)}{total ? ` · ${Math.round((v / total) * 100)}%` : ''}</b></div>
              {m > 0 && <div className="barra"><i style={{ width: Math.min(p * 100, 100) + '%', background: p >= 1 ? '#ef4444' : p >= 0.8 ? '#f59e0b' : '#10b981' }} /></div>}
              {m > 0 && p >= 0.8 && <small className="alerta">{p >= 1 ? '🔴 Meta estourada' : '🟠 Chegando no limite da meta'}</small>}
              <input key={c + (m || '')} className="meta" inputMode="decimal" placeholder="meta mensal (R$)" defaultValue={m ? String(m).replace('.', ',') : ''} onBlur={e => salvarMeta(c, e.target.value)} />
            </div>
          );
        })}
        {!Object.keys(cat).length && <p className="vazio">Lance contas para ver as categorias.</p>}
      </div>
    </section>
  );
}
