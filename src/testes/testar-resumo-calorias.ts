// Teste do resumo de calorias (fechamento da Fase 3): o resumo diário (cron) e
// a consulta na hora ("quantas calorias comi hoje?"). Banco em memória, sem LLM
// nem cron nem WhatsApp — só banco + formatador. Uso: npm run testar:resumo-calorias

import { salvarRefeicao } from "../db.ts";
import { inicioDoDia } from "../tempo.ts";
import { resumoDiario, consumoDeHoje } from "../skills/resumo-calorias.ts";

const destino = "teste@s.whatsapp.net";
const agora = Date.now();

// Refeições de HOJE (devem aparecer e somar o total).
salvarRefeicao("bolo de rolo", 450, destino, agora);
salvarRefeicao("feijoada", 800, destino, agora);
salvarRefeicao("açaí com granola", 350, destino, agora);

// Refeição de ONTEM (1 segundo antes da meia-noite de hoje): NÃO pode entrar —
// é o teste da janela "início do dia". Se aparecer, a janela está furada.
salvarRefeicao("pizza de ontem", 1200, destino, inicioDoDia() - 1000);

// 1. O fechamento diário (o que a cron das 21h manda). Deve listar as 3 de hoje
//    e somar 1600 kcal — sem a pizza de ontem.
console.log("--- resumo diário (cron) ---");
console.log(resumoDiario(destino) ?? "(null — não deveria, tem refeição hoje!)");

// 2. A consulta na hora — mesmo dado, título de consulta.
console.log("\n--- consulta 'quantas calorias hoje?' ---");
console.log(consumoDeHoje(destino));

// 3. Conversa SEM refeição hoje: a cron silencia (null), a consulta responde.
console.log("\n--- conversa sem refeição hoje ---");
console.log("cron   → " + (resumoDiario("vazio@s.whatsapp.net") ?? "(null, ok!)"));
console.log("consulta → " + consumoDeHoje("vazio@s.whatsapp.net"));
