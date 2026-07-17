// Teste da consulta "quanto gastei hoje?" (evolução do Financeiro).
// Banco em memória, sem LLM. Uso: npm run testar:consulta

import { salvarGasto } from "../db.ts";
import { inicioDoDia } from "../tempo.ts";
import { extratoDeHoje } from "../skills/consultar-gastos.ts";

const destino = "teste@s.whatsapp.net";
const agora = Date.now();

// Gastos de HOJE (devem aparecer e somar).
salvarGasto(4590, "mercado", "compras", destino, agora);
salvarGasto(1200, "transporte", "uber", destino, agora);

// Gasto de ONTEM (1 segundo antes da meia-noite de hoje): NÃO pode entrar no
// extrato de hoje — é o teste da janela "início do dia".
salvarGasto(9999, "lazer", "cinema ontem", destino, inicioDoDia() - 1000);

console.log(extratoDeHoje(destino));

// Conversa sem gasto nenhum hoje → responde "nada ainda" (não fica em silêncio).
console.log("\n--- sem gastos hoje ---");
console.log(extratoDeHoje("vazio@s.whatsapp.net"));
