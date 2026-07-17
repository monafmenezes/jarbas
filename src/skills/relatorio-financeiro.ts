// 📊 Skill do relatório financeiro semanal.
// Monta o texto do resumo de gastos por categoria. É de propósito SEM efeito
// colateral (não envia nada, não sabe de WhatsApp) — só recebe números e
// devolve string. Quem dispara e envia é o agendador. Assim dá pra testar o
// texto isolado, sem cron nem conexão.

import { gastosPorCategoria, type ResumoCategoria } from "../db.ts";

// Centavos -> "R$ 45,90". Igual ao roteador: a divisão por 100 mora na borda.
function emReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

// Monta o texto a partir de um resumo já somado. Devolve null quando não há
// gasto nenhum — o agendador usa isso pra NÃO mandar um relatório vazio.
export function montarRelatorio(resumo: ResumoCategoria[]): string | null {
  if (resumo.length === 0) return null;

  const total = resumo.reduce((soma, r) => soma + r.total, 0);
  const linhas = resumo.map((r) => `• ${r.categoria}: ${emReais(r.total)}`);

  return (
    "📊 Seu resumo de gastos da semana:\n\n" +
    linhas.join("\n") +
    `\n\n💰 Total: ${emReais(total)}`
  );
}

// Junta banco + formatação: pega o resumo da conversa e monta o texto.
export function relatorioSemanal(destino: string, desde: number): string | null {
  return montarRelatorio(gastosPorCategoria(destino, desde));
}
