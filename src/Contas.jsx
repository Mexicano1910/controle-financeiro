import { useState } from 'react';
import { supabase } from './supabase.js';
import { brl, fmtData, hoje, norm, somaMes } from './lib/util.js';

// Para contas recorrentes: avisa se o valor veio >20% acima da média dos meses anteriores.
function acimaDaMedia(c, todas) {
  if (!c.recorrente) return null;
  const k = norm(c.beneficiario || c.descricao);
  const ant = todas.filter(x => x.escopo === c.escopo && x.id !== c.id && x.vencimento < c.vencimento && norm(x.beneficiario || x.descricao) === k)
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento)).slice(0, 3);
  if (ant.length < 2) return null;
  const med = ant.reduce((s, x) => s + Number(x.valor), 0) / ant.length;
  const d = (c.valor - med) / med;
  return d > 0.2 ? Math.round(d * 100) : null;
}

export default function Contas({ escopo, casaId, contas, user, onEditar, reload }) {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const todas = contas.filter(c => c.escopo === escopo);
  const lista = todas.filter(c => c.vencimento.startsWith(mes)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const total = lista.reduce((s, c) => s + Number(c.valor), 0);
  const pendente = lista.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.valor), 0);

  const mudar = async (c, dados) => { await supabase.from('contas').update(dados).eq('id', c.id); reload(); };
  const excluir = async c => { if (confirm(`Excluir "${c.descricao}"?`)) { await supabase.from('contas').delete().eq('id', c.id); reload(); } };

  async function repetir() {
    const ant = somaMes(mes, -1);
    const [y, m] = mes.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    const jaTem = new Set(lista.map(c => norm(c.beneficiario || c.descricao)));
    const novas = todas.filter(c => c.recorrente && c.vencimento.startsWith(ant) && !jaTem.has(norm(c.beneficiario || c.descricao)))
      .map(c => ({ dono_id: user.id, escopo, casa_id: escopo === 'casa' ? casaId : null, descricao: c.descricao, beneficiario: c.beneficiario, categoria: c.categoria, valor: c.valor, recorrente: true,
        vencimento: `${mes}-${String(Math.min(+c.vencimento.slice(8, 10), ultimo)).padStart(2, '0')}` }));
    if (!novas.length) return alert('Nenhuma conta recorrente do mês anterior para repetir.');
    await supabase.from('contas').insert(novas);
    reload();
  }

  function exportar() {
    const cab = ['Vencimento', 'Descrição', 'Categoria', 'Valor', 'Status', 'Pago em'];
    const linhas = todas.map(c => [c.vencimento, c.descricao, c.categoria, String(c.valor).replace('.', ','), c.status, c.pago_em || '']
      .map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['\ufeff' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contas-${escopo}.csv`;
    a.click();
  }

  return (
    <section>
      <div className="linha">
        <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} />
        <div className="resumo"><b>{brl(total)}</b><small>a pagar: {brl(pendente)}</small></div>
      </div>
      {!lista.length && <p className="vazio">Nenhuma conta neste mês. Toque no ＋ para enviar um PDF.</p>}
      {lista.map(c => {
        const vencida = c.status === 'pendente' && c.vencimento < hoje();
        const alta = acimaDaMedia(c, todas);
        return (
          <div key={c.id} className={'conta ' + (c.status === 'paga' ? 'paga' : vencida ? 'vencida' : '')}>
            <div className="info" onClick={() => onEditar(c)}>
              <b>{c.descricao}</b>
              <small>{fmtData(c.vencimento)} · {c.categoria}{c.recorrente ? ' · 🔁' : ''}</small>
              {alta && <small className="alerta">⚠️ {alta}% acima da média</small>}
            </div>
            <div className="dir">
              <b>{brl(c.valor)}</b>
              {c.status === 'paga'
                ? <button onClick={() => mudar(c, { status: 'pendente', pago_em: null })}>✅ paga</button>
                : <button className="prim" onClick={() => mudar(c, { status: 'paga', pago_em: hoje() })}>{vencida ? 'Vencida · pagar' : 'Pagar'}</button>}
              <button className="x" onClick={() => excluir(c)}>🗑</button>
            </div>
          </div>
        );
      })}
      <div className="linha acoes">
        <button onClick={repetir}>🔁 Repetir recorrentes do mês anterior</button>
        <button onClick={exportar}>⬇️ Exportar (Planilhas/Excel)</button>
      </div>
    </section>
  );
}
