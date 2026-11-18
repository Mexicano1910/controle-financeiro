import { useState } from "react";
import { supabase } from "./supabase.js";
import { fmtData, num } from "./lib/util.js";

export default function Ajustes({ user, d, reload }) {
  const { perfil, perfis, config, temCasa, membros } = d;
  const [nome, setNome] = useState(perfil.nome || "");
  const [topic, setTopic] = useState(perfil.ntfy_topic || "");
  const [renda, setRenda] = useState(
    String(perfil.renda || "").replace(".", ","),
  );
  const [nomeCasa, setNomeCasa] = useState(config?.nome || "");
  const [pagador, setPagador] = useState(config?.pagador || "");
  const [pct, setPct] = useState(config?.pct_pagador ?? 50);
  const [rendaCasa, setRendaCasa] = useState(
    String(config?.renda_casa || "").replace(".", ","),
  );
  const [ok, setOk] = useState("");
  const moradores = perfis.filter((p) =>
    membros.some((m) => m.user_id === p.id),
  );

  async function salvar(e) {
    e.preventDefault();
    await supabase
      .from("perfis")
      .update({ nome, ntfy_topic: topic || null, renda: num(renda) || 0 })
      .eq("id", user.id);
    if (temCasa && config) {
      await supabase
        .from("casas")
        .update({
          nome: nomeCasa || "Minha casa",
          pagador: pagador || null,
          pct_pagador: Number(pct) || 50,
          renda_casa: num(rendaCasa) || 0,
        })
        .eq("id", config.id);
    }
    setOk("Salvo ✔");
    reload();
  }

  return (
    <>
      <form className="card" onSubmit={salvar}>
        <h3>Meu perfil</h3>
        <input
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <input
          inputMode="decimal"
          placeholder="Minha renda mensal (R$)"
          value={renda}
          onChange={(e) => setRenda(e.target.value)}
        />
        <h3>Avisos de vencimento</h3>
        <small>
          Instale o app gratuito <b>ntfy</b> (iPhone/Android) e assine o tópico
          abaixo. Os avisos chegam todo dia de manhã.
        </small>
        <div className="dois">
          <input
            placeholder="Tópico do ntfy"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button
            type="button"
            onClick={() =>
              setTopic(
                "fin-" + crypto.randomUUID().replace(/-/g, "").slice(0, 14),
              )
            }
          >
            Gerar
          </button>
        </div>
        {temCasa && config && (
          <>
            <h3>Casa</h3>
            <input
              placeholder="Nome da casa"
              value={nomeCasa}
              onChange={(e) => setNomeCasa(e.target.value)}
            />
            <input
              inputMode="decimal"
              placeholder="Renda mensal da casa (R$)"
              value={rendaCasa}
              onChange={(e) => setRendaCasa(e.target.value)}
            />
            <select
              value={pagador}
              onChange={(e) => setPagador(e.target.value)}
            >
              <option value="">Quem paga as contas da casa?</option>
              {moradores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <label>
              Parte de quem paga: <b>{pct}%</b> (os outros dividem o resto)
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
              />
            </label>
          </>
        )}
        <button className="prim">Salvar</button>
        {ok && <p className="aviso">{ok}</p>}
        <button type="button" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </form>
      {temCasa && config && <GestaoCasa user={user} d={d} reload={reload} />}
    </>
  );
}

function GestaoCasa({ user, d, reload }) {
  const { perfis, membros, convites } = d;
  const souDono = membros.find((m) => m.user_id === user.id)?.papel === "dono";
  const [msg, setMsg] = useState("");
  const nomeDe = (id) => perfis.find((p) => p.id === id)?.nome || "Pessoa";
  const link = (c) => `${location.origin}/?convite=${c}`;

  async function rpc(fn, args) {
    const { error } = await supabase.rpc(fn, args);
    if (error) setMsg(error.message);
    else {
      setMsg("");
      await reload();
    }
  }
  async function compartilhar(c) {
    const texto = `Entre na nossa casa no  Methra: ${link(c)}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        /* cancelado */
      }
      return;
    }
    await navigator.clipboard.writeText(texto);
    setMsg("Link copiado! Cole numa mensagem para a pessoa.");
  }
  async function revogar(codigo) {
    await supabase.from("convites").delete().eq("codigo", codigo);
    reload();
  }
  function remover(m) {
    const eu = m.user_id === user.id;
    const aviso = eu
      ? membros.length === 1
        ? "Você é a última pessoa da casa: as contas da casa serão APAGADAS. Continuar?"
        : "Sair da casa? Você continua com suas contas pessoais."
      : `Remover ${nomeDe(m.user_id)} da casa? A pessoa continua com as contas pessoais dela, mas perde o acesso às da casa.`;
    if (confirm(aviso)) rpc("remover_membro", { p_user: m.user_id });
  }

  return (
    <div className="card">
      <h3>Quem mora na casa</h3>
      {membros.map((m) => (
        <div key={m.user_id} className="membro">
          <span>
            {nomeDe(m.user_id)}
            {m.papel === "dono" ? " · dono(a)" : ""}
            {m.user_id === user.id ? " (você)" : ""}
          </span>
          {m.user_id === user.id ? (
            <button onClick={() => remover(m)}>Sair da casa</button>
          ) : (
            souDono && <button onClick={() => remover(m)}>Remover</button>
          )}
        </div>
      ))}
      {souDono && (
        <>
          <h3>Convidar alguém</h3>
          <small>
            Gere um convite e envie para a pessoa. Ela cria a conta pelo link e
            já entra na casa. Cada convite vale 7 dias e serve para uma pessoa.
          </small>
          <button className="prim" onClick={() => rpc("gerar_convite")}>
            ＋ Gerar convite
          </button>
          {convites.map((c) => (
            <div key={c.codigo} className="membro">
              <span>
                <span className="cod">{c.codigo}</span>
                <br />
                <small>vale até {fmtData(c.expira_em.slice(0, 10))}</small>
              </span>
              <span>
                <button onClick={() => compartilhar(c.codigo)}>Enviar</button>{" "}
                <button className="x" onClick={() => revogar(c.codigo)}>
                  🗑
                </button>
              </span>
            </div>
          ))}
        </>
      )}
      {msg && <p className="aviso">{msg}</p>}
    </div>
  );
}
