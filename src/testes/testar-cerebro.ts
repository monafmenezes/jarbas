// Teste isolado do cérebro — roda SEM precisar do WhatsApp conectado.
// Uso: npm run testar:cerebro   (precisa da OPENAI_API_KEY no .env)

import { OpenAIBrain } from "../brain.ts";

const brain = new OpenAIBrain();

// Um texto propositalmente longo pra ver o resumo "espremendo" o essencial.
const texto = `
O Baileys é uma biblioteca não-oficial que conversa com o WhatsApp Web pelo
mesmo protocolo do aplicativo, usando WebSocket. Diferente da Cloud API oficial
da Meta, ele não exige aprovação, número dedicado nem templates de mensagem, o
que o torna ótimo para projetos pessoais e protótipos. Em troca, por ser não
oficial, existe o risco de o número ser banido caso o uso pareça automatizado
demais — por isso o ideal é rodar num número secundário ou com uso leve. A
sessão é persistida em disco para não precisar escanear o QR Code toda vez.
`;

console.log("🧠 Pedindo um resumo ao cérebro...\n");
const resumo = await brain.resumir(texto);
console.log("📄 Resumo:\n" + resumo + "\n");

// ─── Teste do roteador (classificarIntencao) ─────────────────────────────────
console.log("🧭 Testando a classificação de intenção...\n");

const exemplos = [
  "resume esse artigo pra mim: https://exemplo.com/post",
  "me lembra de pagar o boleto amanhã às 9h",
  "qual é a capital da Austrália?",
];

for (const frase of exemplos) {
  const intencao = await brain.classificarIntencao(frase);
  console.log(`  "${frase}"\n   → ${intencao}\n`);
}
