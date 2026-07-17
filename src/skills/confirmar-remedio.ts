// ✋ Confirmação de remédio por PALAVRA-CHAVE (decisão dela: robusto e instantâneo,
// sem depender do LLM). O roteador chama `ehConfirmacao` ANTES de perguntar a
// intenção ao cérebro — se bater, nem gasta uma chamada de IA.

import { dosesPendentesDe, marcarDose, remedioPorId } from "../db.ts";
import { diaLocal } from "../tempo.ts";

// Formas aceitas de dizer "tomei", já normalizadas (sem acento/pontuação).
const CONFIRMACOES = new Set([
  "tomei",
  "ja tomei",
  "tomei sim",
  "tomado",
  "tomei o remedio",
  "ja tomei o remedio",
]);

// Tira acento, pontuação e espaços extras pra comparar. "Já tomei!" -> "ja tomei".
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove os acentos (marcas combinantes)
    .replace(/[^\w\s]/g, "") // remove pontuação
    .trim()
    .replace(/\s+/g, " ");
}

// A mensagem é uma confirmação de remédio? Match EXATO da frase inteira (não só
// "contém tomei") pra não confundir "tomei um susto" ou "já tomei café".
export function ehConfirmacao(texto: string): boolean {
  return CONFIRMACOES.has(normalizar(texto));
}

// Marca como tomadas as doses pendentes de hoje — e para de insistir nelas.
export function confirmarRemedios(
  destino: string,
  agora: Date = new Date(),
): string {
  const pendentes = dosesPendentesDe(destino, diaLocal(agora));
  if (pendentes.length === 0) {
    return "💊 não tem nenhum remédio esperando confirmação agora. 🤔";
  }
  const nomes = pendentes.map((dose) => {
    marcarDose(dose.id, "tomado"); // pendente → tomado: o verificador para de cutucar
    return remedioPorId(dose.remedio_id)?.nome ?? "remédio";
  });
  return `✅ anotado! marquei como tomado: ${nomes.join(", ")}. 💊`;
}
