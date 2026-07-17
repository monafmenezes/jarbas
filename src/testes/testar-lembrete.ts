// Teste isolado da extração de lembrete (Etapa 2 da skill criar_lembrete).
// Usa o cérebro/LLM. Uso: npm run testar:lembrete

import { OpenAIBrain } from "../brain.ts";

const brain = new OpenAIBrain();
const agora = new Date();

const frases = [
  "me lembra de pagar o boleto amanhã às 9h",
  "me lembra de ligar pro dentista daqui 2 horas",
  "me lembra de comprar pão", // sem hora → deve dar null
];

// Formata um epoch de volta no fuso da Monalisa pra conferência visual.
const humano = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(ms));

console.log(`🕐 agora: ${humano(agora.getTime())}\n`);

for (const frase of frases) {
  const r = await brain.extrairLembrete(frase, agora);
  if (r) {
    console.log(`  "${frase}"\n   → "${r.texto}" em ${humano(r.quando)}\n`);
  } else {
    console.log(`  "${frase}"\n   → (não deu pra saber quando)\n`);
  }
}
