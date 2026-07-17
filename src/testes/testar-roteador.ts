// Teste do fluxo ponta a ponta do roteador (Etapa 3 da skill registrar_gasto):
// texto -> classifica intenção -> despacha pra skill -> resposta pronta.
// Usa o cérebro/LLM real e banco em memória. Uso: npm run testar:roteador

import { OpenAIBrain } from "../brain.ts";
import { rotearTexto } from "../roteador.ts";

const brain = new OpenAIBrain();
const destino = "teste@s.whatsapp.net";

const frases = [
  "gastei 45,90 no mercado", // → registrar_gasto
  "paguei 12 de uber pro trabalho", // → registrar_gasto
  "me lembra de pagar o boleto amanhã às 9h", // → criar_lembrete (não regrediu)
  "qual a capital da França?", // → conversa (não virou gasto)
];

for (const frase of frases) {
  const resposta = await rotearTexto(frase, brain, destino);
  console.log(`  "${frase}"\n   → ${resposta}\n`);
}
