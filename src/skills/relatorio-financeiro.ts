// 📊 Skill do relatório financeiro semanal + formatação de resumo de gastos.
// As funções aqui são de propósito SEM efeito colateral (não enviam nada, não
// sabem de WhatsApp) — só recebem números e devolvem string. Quem dispara e
// envia é o agendador. Assim dá pra testar o texto isolado, sem cron nem conexão.

import { gastosPorCategoria, type ResumoCategoria } from "../db.ts";

// Centavos -> "R$ 45,90". A divisão por 100 mora na borda (formatação).
// Exportada porque o roteador e a consulta de hoje também formatam dinheiro.
export function emReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

// Formata um resumo (já somado por categoria) num texto: título + uma linha por
// categoria + total. Assume o resumo NÃO vazio — quem chama decide o que fazer
// com o vazio (o relatório semanal não manda nada; a consulta de hoje responde
// "nada ainda"). É o pedaço reusado entre o relatório e o extrato do dia.
export function montarResumo(titulo: string, resumo: ResumoCategoria[]): string {
  const total = resumo.reduce((soma, r) => soma + r.total, 0);
  const linhas = resumo.map((r) => `• ${r.categoria}: ${emReais(r.total)}`);
  return `${titulo}\n\n` + linhas.join("\n") + `\n\n💰 Total: ${emReais(total)}`;
}

// Junta banco + formatação pro relatório semanal. Devolve null quando não há
// gasto nenhum — o agendador usa isso pra NÃO mandar um relatório vazio.
export function relatorioSemanal(destino: string, desde: number): string | null {
  const resumo = gastosPorCategoria(destino, desde);
  if (resumo.length === 0) return null;
  return montarResumo("📊 Seu resumo de gastos da semana:", resumo);
}
