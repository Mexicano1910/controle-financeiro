import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { lerImagem } from "./ocr.js";
pdfjs.GlobalWorkerOptions.workerSrc = worker;

// Lê o PDF no próprio navegador (nada é enviado a nenhum servidor) e devolve as linhas de texto.
export async function lerPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: data.slice() }).promise;
  } catch (e) {
    if (e.name !== "PasswordException") throw e;
    const senha = prompt(
      "Este PDF tem senha (geralmente os primeiros dígitos do CPF). Digite:",
    );
    if (!senha) throw new Error("PDF com senha");
    pdf = await pdfjs.getDocument({ data: data.slice(), password: senha })
      .promise;
  }
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    const grupos = new Map();
    for (const it of conteudo.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      if (!grupos.has(y)) grupos.set(y, []);
      grupos.get(y).push(it);
    }
    [...grupos.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, its]) => {
        its.sort((a, b) => a.transform[4] - b.transform[4]);
        linhas.push(
          its
            .map((i) => i.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        );
      });
  }
  if (linhas.join("").length < 20) return ocrPaginas(pdf); // PDF que é só uma imagem (ex.: comprovante do WhatsApp)
  return linhas;
}

async function ocrPaginas(pdf) {
  const linhas = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp })
      .promise;
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    linhas.push(...(await lerImagem(blob)));
  }
  return linhas;
}
