import { createWorker } from 'tesseract.js';

// Lê o texto de um print/foto no próprio navegador (grátis). Na 1ª vez baixa o idioma português (alguns MB).
export async function lerImagem(file) {
  const worker = await createWorker('por');
  try {
    const { data } = await worker.recognize(file);
    return data.text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  } finally {
    await worker.terminate();
  }
}
