import { useState } from 'react';
import { supabase } from './supabase.js';
import { lerPdf } from './lib/pdf.js';
import { lerImagem } from './lib/ocr.js';
import { lerLinha, valorDoTexto, vencDoTexto, dataDoTexto, beneficiarioDoTexto } from './lib/boleto.js';
import { sugerir, CATEGORIAS } from './lib/regras.js';
import { brl, fmtData, hoje, norm, num } from './lib/util.js';

const vazio = { descricao: '', beneficiario: '', categoria: 'Outros', escopo: '', valor: '', vencimento: '', status: 'pendente', pago_em: '', codigo_barras: '', recorrente: false };
const virgula = v => (v == null ? '' : String(v).replace('.', ','));

export default function Novo({ user, temCasa, casaId, extras = [], contas, regras, escopo, conta, onFechar, onSalvo }) {
  const [f, setF] = useState(conta
    ? { ...vazio, ...conta, valor: virgula(conta.valor), pago_em: conta.pago_em || '', codigo_barras: conta.codigo_barras || '' }
    : { ...vazio, escopo: temCasa ? escopo : 'pessoal' });
  const [msg, setMsg] = useState('');
  const [comp, setComp] = useState(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const travado = conta && conta.dono_id !== user.id; // conta da casa criada pela outra pessoa
  const escopoValido = e => (e === 'casa' && !temCasa ? '' : e || '');

  async function aoEscolherPdf(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(file.type.startsWith('image/') ? 'Lendo a imagem… (na primeira vez demora um pouco)' : 'Lendo o PDF…'); setComp(null);
    try {
      const linhas = file.type.startsWith('image/') ? await lerImagem(file) : await lerPdf(file);
      const texto = linhas.join('\n');
      const l = lerLinha(texto, hoje());
      const ben = beneficiarioDoTexto(linhas);
      const s = sugerir(ben, regras, user.id);
      if (l) { // boleto / conta a pagar
        if (contas.some(c => c.codigo_barras === l.linha)) return setMsg('Essa conta já foi lançada.');
        const venc = l.vencimento || vencDoTexto(texto) || '';
        setF({ ...vazio, beneficiario: ben, descricao: ben, categoria: s.categoria, escopo: escopoValido(s.escopo), codigo_barras: l.linha,
          valor: virgula(l.valor ?? valorDoTexto(texto)), vencimento: venc });
        setMsg(venc ? 'Confira os dados e escolha Casa ou Pessoal.' : 'Não achei o vencimento: preencha e escolha Casa ou Pessoal.');
      } else { // comprovante / extrato de algo já pago
        const valor = valorDoTexto(texto), data = dataDoTexto(texto) || hoje();
        const pend = valor == null ? [] : contas.filter(c => c.status === 'pendente' && Math.abs(c.valor - valor) < 0.005);
        setComp({ valor, data, ben, pend });
        setMsg('');
      }
    } catch (err) { setMsg('Não consegui ler esse arquivo (' + err.message + '). Preencha manualmente.'); }
    e.target.value = '';
  }

  async function baixar(c) {
    const { error } = await supabase.from('contas').update({ status: 'paga', pago_em: comp.data }).eq('id', c.id);
    if (error) return setMsg(error.message);
    onSalvo();
  }
  function comoGastoPago() {
    const s = sugerir(comp.ben, regras, user.id);
    setF({ ...vazio, beneficiario: comp.ben, descricao: comp.ben, categoria: s.categoria, escopo: escopoValido(s.escopo), valor: virgula(comp.valor), vencimento: comp.data, status: 'paga', pago_em: comp.data });
    setComp(null);
    setMsg('Gasto já pago. Confira e escolha Casa ou Pessoal.');
  }

  async function salvar(e) {
    e.preventDefault();
    if (!f.escopo) return setMsg('Escolha Casa ou Pessoal.');
    const v = num(f.valor);
    if (!(v > 0) || !f.vencimento) return setMsg('Preencha valor e data.');
    const dados = { escopo: f.escopo, descricao: f.descricao || f.beneficiario || 'Conta', beneficiario: f.beneficiario, categoria: f.categoria, valor: v, vencimento: f.vencimento,
      status: f.status, pago_em: f.status === 'paga' ? f.pago_em || hoje() : null, recorrente: f.recorrente, casa_id: f.escopo === 'casa' ? casaId : null };
    const { error } = conta
      ? await supabase.from('contas').update(dados).eq('id', conta.id)
      : await supabase.from('contas').insert({ ...dados, dono_id: user.id, codigo_barras: f.codigo_barras || null });
    if (error) return setMsg(error.code === '23505' ? 'Essa conta já foi lançada.' : error.message);
    if (f.beneficiario) await supabase.from('regras').upsert({ dono_id: user.id, chave: norm(f.beneficiario), escopo: f.escopo, categoria: f.categoria, casa_id: f.escopo === 'casa' ? casaId : null }, { onConflict: 'dono_id,chave' });
    onSalvo();
  }

  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onFechar()}>
      <form className="card folha" onSubmit={salvar}>
        <div className="linha"><h2>{conta ? 'Editar conta' : 'Nova conta'}</h2><button type="button" onClick={onFechar}>✕</button></div>
        {!conta && <label className="arquivo">📄 Enviar PDF ou print (boleto, conta ou comprovante)<input type="file" accept="application/pdf,image/*" onChange={aoEscolherPdf} hidden /></label>}
        {msg && <p className="aviso">{msg}</p>}
        {comp && (
          <div className="comp">
            <p>Comprovante lido: <b>{comp.valor != null ? brl(comp.valor) : 'valor não encontrado'}</b> em {fmtData(comp.data)}{comp.ben ? ` · ${comp.ben}` : ''}</p>
            {comp.pend.map(c => <button type="button" key={c.id} className="prim" onClick={() => baixar(c)}>Dar baixa: {c.descricao} ({brl(c.valor)}, vence {fmtData(c.vencimento)})</button>)}
            <button type="button" onClick={comoGastoPago}>{comp.pend.length ? 'É outro gasto (já pago)' : 'Lançar como gasto já pago'}</button>
          </div>
        )}
        <div className="dois">
          {temCasa && <button type="button" disabled={travado} className={f.escopo === 'casa' ? 'on' : ''} onClick={() => set('escopo', 'casa')}>🏠 Casa</button>}
          <button type="button" disabled={travado} className={f.escopo === 'pessoal' ? 'on' : ''} onClick={() => set('escopo', 'pessoal')}>👤 Pessoal</button>
        </div>
        <input placeholder="Descrição (ex.: Conta de luz)" value={f.descricao} onChange={e => set('descricao', e.target.value)} />
        <input placeholder="Quem recebe (ex.: Enel)" value={f.beneficiario} onChange={e => set('beneficiario', e.target.value)}
          onBlur={() => { if (!conta && f.beneficiario) { const s = sugerir(f.beneficiario, regras, user.id); setF(x => ({ ...x, categoria: s.categoria, escopo: x.escopo || escopoValido(s.escopo) })); } }} />
        <select value={f.categoria} onChange={e => set('categoria', e.target.value)}>{[...new Set([...CATEGORIAS, ...extras, f.categoria])].map(c => <option key={c}>{c}</option>)}</select>
        <div className="dois">
          <input inputMode="decimal" placeholder="Valor (ex.: 230,10)" value={f.valor} onChange={e => set('valor', e.target.value)} />
          <input type="date" value={f.vencimento} onChange={e => set('vencimento', e.target.value)} />
        </div>
        <label className="chk"><input type="checkbox" checked={f.status === 'paga'} onChange={e => set('status', e.target.checked ? 'paga' : 'pendente')} /> Já está paga</label>
        <label className="chk"><input type="checkbox" checked={f.recorrente} onChange={e => set('recorrente', e.target.checked)} /> Repete todo mês</label>
        <button className="prim">Salvar</button>
      </form>
    </div>
  );
}
