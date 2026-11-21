import { useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from './supabase.js';
import { brl, fmtData, hoje, num, somaMes } from './lib/util.js';
import { CATEGORIAS } from './lib/regras.js';
import { fixa, linhasAcerto, parteDaCasa, porCat, soma, variacoes } from './lib/analise.js';

const CORES = ['#E0A526', '#B87333', '#D9D9D9', '#686868', '#F2C14E', '#8A5A2B', '#FFFFFF', '#A0A0A0', '#C98A3C', '#4a4a4a'];
const VERDE = '#10b981', AMARELO = '#eab308', VERMELHO = '#ef4444';

const L = ({ r, v, forte, cor }) => (
  <div className="linha"><span>{r}</span>{forte ? <b style={cor ? { color: cor } : undefined}>{v}</b> : <span>{v}</span>}</div>
);

export default function Painel({ escopo, user, contas, perfil, perfis, membros, config, pagamentos, reload }) {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [novaMeta, setNovaMeta] = useState({ aberto: false, nome: '', valor: '' });
  const [pg, setPg] = useState({ quem: '', valor: '' });

  const dm = (arr, m) => arr.filter(c => c.vencimento.startsWith(m));
  const todas = contas.filter(c => c.escopo === escopo);
  const atual = dm(todas, mes), anterior = dm(todas, somaMes(mes, -1));
  const cat = porCat(atual);
  const total = soma(atual), totalAnt = soma(anterior);
  const dif = totalAnt ? Math.round(((total - totalAnt) / totalAnt) * 100) : null;
  const pizza = Object.entries(cat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const seis = [-5, -4, -3, -2, -1, 0].map(i => { const m = somaMes(mes, i); return { mes: m.slice(5) + '/' + m.slice(2, 4), total: soma(dm(todas, m)) }; });

  // ---- Assistente ----
  const casaTodas = contas.filter(c => c.escopo === 'casa');
  const totalCasa = soma(dm(casaTodas, mes)), totalCasaAnt = soma(dm(casaTodas, somaMes(mes, -1)));
  const parte = parteDaCasa(totalCasa, config, membros, user.id);
  const parteAnt = parteDaCasa(totalCasaAnt, config, membros, user.id);
  const ehPessoal = escopo === 'pessoal';
  const temCasa = !!config;
  const gastoTotal = ehPessoal ? total + parte.valor : total; // no pessoal: contas pessoais + a sua parte da casa
  const gastoTotalAnt = ehPessoal ? totalAnt + parteAnt.valor : totalAnt;
  const renda = Number(escopo === 'casa' ? config?.renda_casa : perfil?.renda) || 0;
  const sobra = renda - gastoTotal;
  const usado = renda ? gastoTotal / renda : 0;
  const corStatus = !renda ? undefined : sobra < 0 ? VERMELHO : usado >= 0.9 ? AMARELO : VERDE;

  const vars = variacoes(atual, anterior);
  const subiram = vars.filter(v => v.delta > 0.005).sort((a, b) => b.delta - a.delta).slice(0, 5);
  const diminuiram = vars.filter(v => v.delta < -0.005 && v.agora > 0).sort((a, b) => a.delta - b.delta).slice(0, 3);
  const faltam = vars.filter(v => v.agora === 0).slice(0, 4);
  const fixo = soma(atual.filter(fixa)), variavel = total - fixo;
  const catVar = porCat(atual.filter(c => !fixa(c))), catVarAnt = porCat(anterior.filter(c => !fixa(c)));
  const cortes = Object.entries(catVar).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ---- Metas ----
  const metas = (escopo === 'casa' ? config?.metas : perfil?.metas) || {};
  const nomes = [...new Set([...Object.keys(cat), ...Object.keys(metas)])].sort((a, b) => (cat[b] || 0) - (cat[a] || 0));
  const todasCats = [...new Set([...CATEGORIAS, ...Object.keys(metas), ...Object.keys(cat)])];

  async function salvarMeta(c, v) {
    const n = num(v), novas = { ...metas };
    if (n > 0) novas[c] = n; else delete novas[c];
    if (escopo === 'casa') await supabase.from('casas').update({ metas: novas }).eq('id', config.id);
    else await supabase.from('perfis').update({ metas: novas }).eq('id', perfil.id);
    reload();
  }
  async function incluirMeta() {
    const nome = novaMeta.nome.trim();
    if (!nome || !(num(novaMeta.valor) > 0)) return alert('Informe a categoria e o valor da meta.');
    await salvarMeta(nome, novaMeta.valor);
    setNovaMeta({ aberto: false, nome: '', valor: '' });
  }

  // ---- Acerto do mês (casa) ----
  const pagador = perfis.find(p => p.id === config?.pagador);
  const acerto = escopo === 'casa' && config ? linhasAcerto(total, config, membros, perfis, pagamentos, mes) : [];
  const pagamentosMes = pagamentos.filter(p => p.mes === mes).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const quemPaga = pg.quem || acerto.find(l => l.restante > 0)?.id || acerto[0]?.id || '';
  const nome = id => (id === user.id ? 'Você' : perfis.find(p => p.id === id)?.nome || 'Pessoa');

  async function registrar(deUser, valor) {
    const v = num(valor);
    if (!(v > 0)) return alert('Informe um valor maior que zero.');
    const { error } = await supabase.from('acerto_pagamentos').insert({ casa_id: config.id, mes, de_user: deUser, valor: v });
    if (error) return alert(error.message);
    setPg({ quem: '', valor: '' });
    reload();
  }
  async function apagarPagamento(id) {
    if (!confirm('Apagar este pagamento?')) return;
    await supabase.from('acerto_pagamentos').delete().eq('id', id);
    reload();
  }

  return (
    <section>
      <div className="linha">
        <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} />
        <div className="resumo"><b>{brl(total)}</b><small>{dif == null ? 'sem mês anterior' : `${dif > 0 ? '+' : ''}${dif}% vs. mês anterior`}</small></div>
      </div>

      {escopo === 'casa' && config && (
        <div className="card">
          <h3>Acerto do mês</h3>
          {!acerto.length ? <p>Defina quem paga as contas da casa em ⚙️ Ajustes.</p> : (
            <>
              {acerto.map(l => (
                <div key={l.id} className="acerto">
                  <p>{l.restante > 0
                    ? <><b>{nome(l.id)}</b> deve <b>{brl(l.restante)}</b> a <b>{pagador?.id === user.id ? 'você' : pagador?.nome}</b></>
                    : <><b>{nome(l.id)}</b> está em dia ✅</>}</p>
                  <small>Parte do mês: {brl(l.devido)} · já acertado: {brl(l.pago)}{l.pago > l.devido ? ` (a mais: ${brl(l.pago - l.devido)})` : ''}</small>
                  <div className="barra"><i style={{ width: Math.min((l.devido ? l.pago / l.devido : 1) * 100, 100) + '%', background: l.restante > 0 ? AMARELO : VERDE }} /></div>
                  {l.restante > 0 && <button type="button" onClick={() => registrar(l.id, String(l.restante).replace('.', ','))}>Quitar o restante ({brl(l.restante)})</button>}
                </div>
              ))}
              <h3>Registrar pagamento</h3>
              <div className="dois">
                {acerto.length > 1 && (
                  <select value={quemPaga} onChange={e => setPg({ ...pg, quem: e.target.value })}>
                    {acerto.map(l => <option key={l.id} value={l.id}>{nome(l.id)}</option>)}
                  </select>
                )}
                <input inputMode="decimal" placeholder="Valor pago (ex.: 150,00)" value={pg.valor} onChange={e => setPg({ ...pg, valor: e.target.value })} />
              </div>
              <button className="prim" onClick={() => registrar(quemPaga, pg.valor)}>Registrar pagamento</button>
              {pagamentosMes.map(p => (
                <div key={p.id} className="membro">
                  <span>{nome(p.de_user)} pagou <b>{brl(p.valor)}</b> <small>em {fmtData(p.criado_em.slice(0, 10))}</small></span>
                  <button className="x" onClick={() => apagarPagamento(p.id)}>🗑</button>
                </div>
              ))}
              {total > 0 && acerto.every(l => l.restante <= 0) && <p className="ok">✅ Acerto do mês concluído</p>}
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Assistente</h3>
        {!renda && <p>Informe a renda {escopo === 'casa' ? 'da casa' : ''} em ⚙️ Ajustes para eu mostrar quanto sobrou.</p>}
        {renda > 0 && <L r={escopo === 'casa' ? 'Renda da casa' : 'Renda'} v={brl(renda)} />}
        {ehPessoal && <L r="Gastos pessoais" v={brl(total)} />}
        {ehPessoal && temCasa && <L r={`Casa (sua parte, ${Math.round(parte.pct)}%)`} v={brl(parte.valor)} />}
        <L r={ehPessoal && temCasa ? 'Total gasto por você' : 'Total gasto'} v={brl(gastoTotal)} forte />
        {renda > 0 && (
          <>
            <L r={sobra < 0 ? 'Faltou' : 'Sobrou'} v={brl(Math.abs(sobra))} forte cor={corStatus} />
            <div className="barra"><i style={{ width: Math.min(usado * 100, 100) + '%', background: corStatus }} /></div>
            <p style={{ color: corStatus }}>
              {sobra < 0 ? `🔴 No vermelho: os gastos passam da renda em ${brl(-sobra)} (${Math.round(usado * 100)}% da renda).`
                : usado >= 0.9 ? `🟡 Atenção: já foram ${Math.round(usado * 100)}% da renda.`
                : `🟢 No azul: foram ${Math.round(usado * 100)}% da renda e sobram ${brl(sobra)}.`}
            </p>
          </>
        )}
        {ehPessoal && temCasa && <small>A parte da casa conta mesmo quando outra pessoa paga o boleto, porque é o que cabe a você no acerto.</small>}
        {gastoTotalAnt > 0 && <small>Comparado ao mês anterior: {gastoTotal >= gastoTotalAnt ? '+' : '−'}{brl(Math.abs(gastoTotal - gastoTotalAnt))}.</small>}

        {total > 0 && <p><b>Fixas:</b> {brl(fixo)} · <b>Variáveis:</b> {brl(variavel)}</p>}

        {subiram.length > 0 && (<>
          <h3>📈 O que subiu vs. mês anterior</h3>
          {subiram.map((v, i) => (
            <p key={i}><b>{v.nome}</b>{v.fixa ? ' (fixa)' : ''}: {v.antes > 0 ? `${brl(v.antes)} → ${brl(v.agora)}` : `novo: ${brl(v.agora)}`} <span style={{ color: VERMELHO }}>(+{brl(v.delta)}{v.pct != null ? `, +${Math.round(v.pct)}%` : ''})</span></p>
          ))}
        </>)}
        {diminuiram.length > 0 && (<>
          <h3>📉 O que diminuiu</h3>
          {diminuiram.map((v, i) => <p key={i}><b>{v.nome}</b>: {brl(v.antes)} → {brl(v.agora)} <span style={{ color: VERDE }}>(−{brl(-v.delta)})</span></p>)}
        </>)}
        {cortes.length > 0 && (<>
          <h3>✂️ Onde dá para economizar</h3>
          <small>Só contas variáveis; as fixas (luz, água, condomínio, as que repetem todo mês) ficam de fora.</small>
          {cortes.map(([k, v]) => (
            <p key={k}><b>{k}</b>: {brl(v)}{catVarAnt[k] ? ` (mês anterior: ${brl(catVarAnt[k])})` : ''}. Cortar 20% economiza <b>{brl(v * 0.2)}</b>.</p>
          ))}
        </>)}
        {faltam.length > 0 && <small>Ainda sem lançamento neste mês: {faltam.map(v => v.nome).join(', ')}.</small>}
      </div>

      <div className="card">
        <h3>Onde gastamos</h3>
        {pizza.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pizza} dataKey="value" nameKey="name" outerRadius={85} label={e => e.name} stroke="none">
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
          <BarChart data={seis}><XAxis dataKey="mes" stroke="#9A9A9A" /><YAxis hide /><Tooltip formatter={v => brl(v)} /><Bar dataKey="total" fill="#E0A526" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="linha"><h3>Categorias e metas</h3><button onClick={() => setNovaMeta({ ...novaMeta, aberto: !novaMeta.aberto })}>＋ Incluir</button></div>
        {novaMeta.aberto && (
          <div className="comp">
            <small>Escolha uma categoria da lista ou digite uma nova. A meta vale mesmo que ainda não exista nenhuma conta nela.</small>
            <input list="categorias-lista" placeholder="Categoria (ex.: Celular, Pets…)" value={novaMeta.nome} onChange={e => setNovaMeta({ ...novaMeta, nome: e.target.value })} />
            <datalist id="categorias-lista">{todasCats.map(c => <option key={c} value={c} />)}</datalist>
            <input inputMode="decimal" placeholder="Meta mensal (R$)" value={novaMeta.valor} onChange={e => setNovaMeta({ ...novaMeta, valor: e.target.value })} />
            <button className="prim" onClick={incluirMeta}>Salvar meta</button>
          </div>
        )}
        {nomes.map(c => {
          const v = cat[c] || 0, m = metas[c], p = m ? v / m : 0;
          return (
            <div key={c} className="cat">
              <div className="linha"><span>{c}</span><b>{brl(v)}{total && v ? ` · ${Math.round((v / total) * 100)}%` : ''}</b></div>
              {m > 0 && <div className="barra"><i style={{ width: Math.min(p * 100, 100) + '%', background: p >= 1 ? VERMELHO : p >= 0.8 ? AMARELO : VERDE }} /></div>}
              {m > 0 && p >= 0.8 && <small className="alerta">{p >= 1 ? '🔴 Meta estourada' : '🟡 Chegando no limite da meta'}</small>}
              <div className="linha">
                <input key={c + (m || '')} className="meta" inputMode="decimal" placeholder="meta mensal (R$)" defaultValue={m ? String(m).replace('.', ',') : ''} onBlur={e => salvarMeta(c, e.target.value)} />
                {m > 0 && !v && <button className="x" onClick={() => salvarMeta(c, '')}>🗑</button>}
              </div>
            </div>
          );
        })}
        {!nomes.length && <p className="vazio">Lance contas ou toque em ＋ Incluir para criar uma meta.</p>}
      </div>
    </section>
  );
}
