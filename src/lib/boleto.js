const dig = (s) => s.replace(/\D/g, "");
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const num = (s) => parseFloat(s.replace(/\./g, "").replace(",", "."));

// Fator de vencimento: base 07/10/1997, reiniciado em 22/02/2025 (fator 1000). Escolhe a data mais próxima de hoje.
function dataDoFator(f, hojeIso) {
  const alvo = Date.parse(hojeIso + "T00:00:00Z");
  const cands = [Date.UTC(1997, 9, 7) + f * 864e5];
  if (f >= 1000) cands.push(Date.UTC(2025, 1, 22) + (f - 1000) * 864e5);
  cands.sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo));
  return iso(cands[0]);
}

// Acha a linha digitável (boleto bancário 47 dígitos ou conta de consumo/convênio 48 dígitos).
export function lerLinha(texto, hojeIso) {
  let m = texto.match(
    /\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14}/,
  );
  if (m) {
    const d = dig(m[0]);
    if (d.length === 47) {
      const f = +d.slice(33, 37),
        v = +d.slice(37, 47) / 100;
      return {
        linha: d,
        valor: v || null,
        vencimento: f > 0 ? dataDoFator(f, hojeIso) : null,
      };
    }
  }
  m = texto.match(/(?:\d{11}[-\s]?\d\s*){4}/);
  if (m) {
    const d = dig(m[0]);
    if (d.length === 48 && d[0] === "8") {
      const sem = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join("");
      const valor = ["6", "8"].includes(sem[2])
        ? +sem.slice(4, 15) / 100
        : null;
      return { linha: d, valor, vencimento: null };
    }
  }
  return null;
}

export function valorDoTexto(t) {
  const m = t.match(
    /(?:valor(?:\s+(?:do\s+documento|a\s+pagar|total|pago|cobrado))?|total\s+a\s+pagar)[^\d\n]{0,25}(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  if (m) return num(m[1]);
  const r = t.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return r ? num(r[1]) : null;
}
export function vencDoTexto(t) {
  const m = t.match(/venc\w*[^\d\n]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
const MESES = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};
// Aceita 16/11/2026, 16 nov 2026 e 16 de novembro de 2026.
export function dataDoTexto(t) {
  let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(
    /(\d{1,2})\s+(?:de\s+)?([a-zç]{3})[a-zç]*\.?\s+(?:de\s+)?(\d{4})/i,
  );
  if (m && MESES[m[2].toLowerCase()])
    return `${m[3]}-${String(MESES[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const CONHECIDOS = [
  [/\benel\b/i, "Enel"],
  [/\bsabesp\b/i, "Sabesp"],
  [/\bcomg[aá]s\b/i, "Comgás"],
  [/\bnaturgy\b/i, "Naturgy"],
  [/\bcpfl\b/i, "CPFL"],
  [/\bcemig\b/i, "Cemig"],
  [/\benergisa\b/i, "Energisa"],
  [/\bifood\b/i, "iFood"],
  [/condom[ií]nio/i, "Condomínio"],
];
const limpaNome = (s) =>
  (s || "")
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*|CNPJ.*|CPF.*|\d.*$/i, "")
    .replace(/[:|]/g, "")
    .trim()
    .slice(0, 40);

const ROTULO =
  /^(cpf|cnpj|institui|origem|destino|banco|chave|valor|nome|tipo|ag[eê]ncia|conta)/i;
const semRotulo = (s) =>
  limpaNome((s || "").replace(/^(nome|para)\b\s*:?\s*/i, ""));

export function beneficiarioDoTexto(linhas) {
  const texto = linhas.join("\n");
  for (const [re, nome] of CONHECIDOS) if (re.test(texto)) return nome;
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(
      /(?:benefici[aá]rio|cedente|favorecido|destinat[aá]rio|recebedor)\s*:?\s*(.*)|^(?:nome|para|destino|quem recebeu)\b\s*:?\s*(.*)$/i,
    );
    if (!m) continue;
    let c = semRotulo(m[1] ?? m[2]);
    let j = i + 1;
    if (!c) {
      c = semRotulo(linhas[j]);
      j++;
    }
    if (c && !/^(nome|para|destino|origem|banco|institui\w*)$/i.test(c)) {
      const prox = (linhas[j] || "").trim(); // nome que quebrou em duas linhas
      if (
        c === c.toUpperCase() &&
        /^[A-ZÀ-Ú ]{3,25}$/.test(prox) &&
        !ROTULO.test(prox)
      )
        c = (c + " " + prox).slice(0, 50);
      return c;
    }
  }
  return limpaNome(linhas.find((l) => /[A-Za-zÀ-ú]{4,}/.test(l)));
}
