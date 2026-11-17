import { norm } from './util.js';

export const CATEGORIAS = ['Moradia', 'Condomínio', 'Luz', 'Água', 'Gás', 'Internet', 'Celular', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Cuidados pessoais', 'Educação', 'Cartão', 'Outros'];
export const FIXAS = ['Moradia', 'Condomínio', 'Luz', 'Água', 'Gás', 'Internet'];

// [padrão, escopo (null = perguntar), categoria]
const PADROES = [
  [/\b(enel|cpfl|cemig|energisa|energia)\b/, 'casa', 'Luz'],
  [/\b(sabesp|sanepar|copasa|cedae|saneamento|agua)\b/, 'casa', 'Água'],
  [/\b(comgas|naturgy|ultragaz|gas)\b/, 'casa', 'Gás'],
  [/condominio/, 'casa', 'Condomínio'],
  [/\b(aluguel|imobiliaria)\b/, 'casa', 'Moradia'],
  [/\b(vivo|claro|tim|oi|telefonica|celular)\b/, 'pessoal', 'Celular'],
  [/\b(ifood|rappi|restaurante|mercado|supermercado|padaria)\b/, null, 'Alimentação'],
  [/\b(barbearia|barbeiro|salao|cabelo|corte)\b/, 'pessoal', 'Cuidados pessoais'],
  [/\b(uber|combustivel|posto|estacionamento)\b/, null, 'Transporte'],
  [/\b(farmacia|drogaria|clinica|medico|dentista)\b/, null, 'Saúde'],
  [/\b(netflix|spotify|cinema|streaming|disney)\b/, null, 'Lazer'],
  [/\b(escola|faculdade|curso)\b/, null, 'Educação'],
  [/\b(cartao|fatura)\b/, null, 'Cartão'],
];

// Primeiro usa o que o app já aprendeu com vocês; depois os padrões prontos.
export function sugerir(beneficiario, regras, meuId) {
  const chave = norm(beneficiario);
  const aprendida = regras.filter(r => r.chave === chave).sort((a, b) => (b.dono_id === meuId) - (a.dono_id === meuId))[0];
  if (aprendida) return { escopo: aprendida.escopo, categoria: aprendida.categoria || 'Outros' };
  for (const [re, escopo, categoria] of PADROES) if (re.test(chave)) return { escopo, categoria };
  return { escopo: null, categoria: 'Outros' };
}
