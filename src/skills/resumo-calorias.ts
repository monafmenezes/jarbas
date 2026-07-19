// 🔥 Skill do resumo de calorias: o fechamento do dia (via cron) + a consulta
// na hora ("quantas calorias já consumi hoje?"). Como o relatorio-financeiro, as
// funções aqui são de propósito SEM efeito colateral (não enviam nada, não sabem
// de WhatsApp) — só recebem dados e devolvem string. Quem dispara e envia é o
// agendador; quem responde a consulta é o roteador. Assim dá pra testar o texto
// isolado, sem cron nem conexão.

import { refeicoesDesde, type RefeicaoResumo } from "../db.ts";
import { inicioDoDia } from "../tempo.ts";

// Formata uma lista de refeições (já do dia) num texto: título + uma linha por
// prato + total. Assume a lista NÃO vazia — quem chama decide o que fazer com o
// vazio (a cron não manda nada; a consulta responde "nada ainda"). É o pedaço
// reusado entre o fechamento automático e a consulta na hora — o gêmeo, pras
// calorias, do montarResumo do dinheiro.
//
// O "~" antes de cada número deixa explícito que é ESTIMATIVA (o cérebro chutou
// pela foto), nunca uma medida cravada — a mesma honestidade que a skill de
// estimar já usa na resposta imediata da foto.
export function montarResumoCalorias(
  titulo: string,
  refeicoes: RefeicaoResumo[],
): string {
  const total = refeicoes.reduce((soma, r) => soma + r.calorias, 0);
  const linhas = refeicoes.map((r) => `• ${r.prato}: ~${r.calorias} kcal`);
  return `${titulo}\n\n` + linhas.join("\n") + `\n\n🔥 Total: ~${total} kcal`;
}

// Junta banco + formatação pro fechamento diário (a cron das 21h). Devolve null
// quando não houve refeição nenhuma no dia — o agendador usa isso pra NÃO mandar
// um resumo vazio (ninguém quer "você comeu 0 kcal" às 21h). A janela é desde a
// MEIA-NOITE de hoje no fuso dela (inicioDoDia), não "últimas 24h": é o dia civil.
export function resumoDiario(destino: string): string | null {
  const refeicoes = refeicoesDesde(destino, inicioDoDia());
  if (refeicoes.length === 0) return null;
  return montarResumoCalorias("🍽️ Seu resumo de calorias de hoje:", refeicoes);
}

// Monta a resposta da consulta na hora ("quantas calorias já consumi hoje?").
// Diferente do fechamento, aqui a gente responde MESMO sem refeição: a pessoa
// PERGUNTOU, então merece um retorno ("nada ainda") em vez de silêncio — mesma
// regra do extratoDeHoje pros gastos. A janela é a mesma: desde a meia-noite.
export function consumoDeHoje(destino: string): string {
  const refeicoes = refeicoesDesde(destino, inicioDoDia());
  if (refeicoes.length === 0) {
    return "🍽️ hoje você ainda não registrou nenhuma refeição por aqui. Manda a foto do prato que eu estimo! 😋";
  }
  return montarResumoCalorias("🍽️ Suas calorias de hoje:", refeicoes);
}
