// Teste do fluxo ponta a ponta do roteador (Etapa 3 da skill registrar_gasto):
// texto -> classifica intenção -> despacha pra skill -> resposta pronta.
// Usa o cérebro/LLM real e banco em memória. Uso: npm run testar:roteador

import { OpenAIBrain } from "../brain.ts";
import { rotearTexto } from "../roteador.ts";

const brain = new OpenAIBrain();
const destino = "teste@s.whatsapp.net";

const frases = [
  "gastei 45,90 no mercado", // → registrar_gasto
  "quanto gastei hoje?", // → consultar_gastos
  // --- gestão de remédios (a história completa) ---
  "tomo o anticoncepcional todo dia às 22h", // cadastra
  "tomo o anticoncepcional todo dia às 22h", // duplicata → deve avisar, não duplicar
  "me lembra de tomar vitamina D às 8h todo dia", // cadastra (≠ lembrete!)
  "quais remédios eu tomo?", // lista os dois
  "para de me lembrar do anticoncepcional", // remove
  "quais remédios eu tomo?", // lista só a vitamina D agora
  "já tomei o remédio hoje?", // → consultar_remedios (status do dia)
  "tomei", // → atalho de confirmação (NÃO passa pelo cérebro)
  // --- não-regressão ---
  "me lembra de pagar o boleto amanhã às 9h", // → criar_lembrete
  "qual a capital da França?", // → conversa
];

for (const frase of frases) {
  const resposta = await rotearTexto(frase, brain, destino);
  console.log(`  "${frase}"\n   → ${resposta}\n`);
}
