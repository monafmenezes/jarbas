// 🧾 Skill de consulta de gastos: o extrato de HOJE ("quanto gastei hoje?").
// Reusa TUDO que já existe: a mesma agregação por categoria do relatório
// semanal (gastosPorCategoria) e o mesmo formatador (montarResumo). A única
// diferença pro relatório é a JANELA DE TEMPO — "desde a meia-noite de hoje"
// em vez de "últimos 7 dias".

import { gastosPorCategoria } from "../db.ts";
import { inicioDoDia } from "../tempo.ts";
import { montarResumo } from "./relatorio-financeiro.ts";

// Monta a resposta do "quanto gastei hoje?" pra uma conversa. Diferente do
// relatório semanal, aqui respondemos MESMO sem gasto: a pessoa PERGUNTOU, então
// merece um retorno ("nada ainda") em vez de silêncio.
export function extratoDeHoje(destino: string): string {
  const resumo = gastosPorCategoria(destino, inicioDoDia());
  if (resumo.length === 0) {
    return "🧾 hoje você ainda não registrou nenhum gasto por aqui. 👏";
  }
  return montarResumo("🧾 Seus gastos de hoje:", resumo);
}
