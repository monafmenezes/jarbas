// Jarbas 🤵 — ponto de entrada.
// Aqui a gente MONTA as peças: cria o cérebro e o entrega à conexão do WhatsApp.
// É o único lugar que decide QUAL cérebro usar — trocar de provedor é só aqui.

import { conectarWhatsApp } from "./whatsapp.ts";
import { OpenAIBrain } from "./brain.ts";

console.log("🤵 Jarbas acordando...");

const brain = new OpenAIBrain();
await conectarWhatsApp(brain);
