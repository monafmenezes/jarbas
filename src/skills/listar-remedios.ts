// 💊 Skill de listagem: mostra os remédios que a pessoa tem cadastrados.
// Só lê o banco e formata — sem cérebro, sem efeito colateral (igual à consulta
// de gastos). É a resposta pro "quais remédios eu tomo?".

import { remediosAtivosDe } from "../db.ts";

export function listaDeRemedios(destino: string): string {
  const remedios = remediosAtivosDe(destino);
  if (remedios.length === 0) {
    return '💊 você ainda não cadastrou nenhum remédio. Tenta: "tomo a vitamina D todo dia às 8h".';
  }
  const linhas = remedios.map((r) => `• ${r.nome} — ${r.hora}`);
  return "💊 Seus remédios:\n\n" + linhas.join("\n");
}
