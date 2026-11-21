import { norm } from './util.js';
import { FIXAS } from './regras.js';

export const soma = a => a.reduce((s, c) => s + Number(c.valor), 0);
const r2 = x => Math.round(x * 100) / 100;

export const porCat = a => {
  const o = {};
  a.forEach(c => { const k = c.categoria || 'Outros'; o[k] = (o[k] || 0) + Number(c.valor); });
  return o;
};

// Conta fixa = marcada como "repete todo mês" ou de categoria fixa (luz, água, condomínio...)
export const fixa = c => !!c.recorrente || FIXAS.includes(c.categoria);

const chave = c => norm(c.beneficiario || c.descricao) || 'sem nome';

function porConta(a) {
  const o = {};
  a.forEach(c => {
    const k = chave(c);
    if (!o[k]) o[k] = { nome: c.descricao || c.beneficiario || 'Conta', valor: 0, fixa: false };
    o[k].valor += Number(c.valor);
    o[k].fixa = o[k].fixa || fixa(c);
  });
  return o;
}

// Compara cada conta (agrupada por quem recebe) com o mês anterior
export function variacoes(atual, anterior) {
  const a = porConta(atual), b = porConta(anterior);
  const linhas = Object.entries(a).map(([k, x]) => {
    const antes = b[k]?.valor || 0;
    return { nome: x.nome, antes: r2(antes), agora: r2(x.valor), delta: r2(x.valor - antes), pct: antes ? ((x.valor - antes) / antes) * 100 : null, fixa: x.fixa };
  });
  Object.entries(b).forEach(([k, x]) => {
    if (!a[k]) linhas.push({ nome: x.nome, antes: r2(x.valor), agora: 0, delta: r2(-x.valor), pct: -100, fixa: x.fixa });
  });
  return linhas;
}

// Quanto das contas da casa cabe a esta pessoa (quem paga o boleto fica com a % definida; os outros dividem o resto)
export function parteDaCasa(total, config, membros, userId) {
  const n = membros.length;
  if (!config || !n || !membros.some(m => m.user_id === userId)) return { valor: 0, pct: 0 };
  const pctPag = config.pct_pagador == null ? 50 : Number(config.pct_pagador);
  const temPagador = config.pagador && membros.some(m => m.user_id === config.pagador);
  let pct;
  if (n === 1) pct = 100;
  else if (!temPagador) pct = 100 / n;
  else if (userId === config.pagador) pct = pctPag;
  else pct = (100 - pctPag) / (n - 1);
  return { valor: r2((total * pct) / 100), pct };
}

// Acerto do mês: quanto cada pessoa deve a quem paga, já descontando o que foi pago
export function linhasAcerto(total, config, membros, perfis, pagamentos, mes) {
  const pagador = config?.pagador;
  if (!pagador) return [];
  const outros = membros.filter(m => m.user_id !== pagador);
  if (!outros.length) return [];
  const pctPag = config.pct_pagador == null ? 50 : Number(config.pct_pagador);
  const devido = (total * (100 - pctPag)) / 100 / outros.length;
  return outros.map(m => {
    const pago = pagamentos.filter(p => p.mes === mes && p.de_user === m.user_id).reduce((s, p) => s + Number(p.valor), 0);
    return { id: m.user_id, nome: perfis.find(p => p.id === m.user_id)?.nome || 'Pessoa', devido: r2(devido), pago: r2(pago), restante: Math.max(0, r2(devido - pago)) };
  });
}
