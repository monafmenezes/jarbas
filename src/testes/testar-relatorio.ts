// Teste do relatório financeiro semanal (Etapa 4 da skill registrar_gasto).
// Banco em memória, sem cron nem WhatsApp. Uso: npm run testar:relatorio

import { salvarGasto } from "../db.ts";
import { relatorioSemanal } from "../skills/relatorio-financeiro.ts";

const destino = "teste@s.whatsapp.net";
const agora = Date.now();
const UM_DIA = 24 * 60 * 60 * 1000;
const desde = agora - 7 * UM_DIA; // janela: últimos 7 dias

// Gastos DENTRO da semana (devem entrar e somar por categoria).
salvarGasto(4590, "mercado", "compras", destino, agora - 1 * UM_DIA);
salvarGasto(2000, "mercado", "feira", destino, agora - 3 * UM_DIA);
salvarGasto(1200, "transporte", "uber", destino, agora - 2 * UM_DIA);
salvarGasto(3200, "alimentação", "almoço", destino, agora - 4 * UM_DIA);

// Gasto ANTIGO (10 dias atrás): NÃO pode aparecer no relatório da semana.
salvarGasto(9999, "lazer", "cinema mês passado", destino, agora - 10 * UM_DIA);

console.log(relatorioSemanal(destino, desde) ?? "(sem gastos na semana)");

// Conversa sem nenhum gasto → deve devolver null (não manda relatório vazio).
console.log("\n--- conversa sem gastos ---");
console.log(relatorioSemanal("vazio@s.whatsapp.net", desde) ?? "(null, ok!)");
