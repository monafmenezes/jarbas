// Jarbas 🤵 — ponto de entrada.
// Aqui a gente MONTA as peças: cria o cérebro e o entrega à conexão do WhatsApp.
// É o único lugar que decide QUAL cérebro usar — trocar de provedor é só aqui.

import { conectarWhatsApp, enviar } from "./whatsapp.ts";
import { iniciarAgendador } from "./agendador.ts";
import { OpenAIBrain } from "./brain.ts";

console.log("🤵 Jarbas acordando...");

const brain = new OpenAIBrain();
await conectarWhatsApp(brain);

// Liga o agendador, passando a função de envio do WhatsApp. Fica de pé uma vez
// só (fora do conectarWhatsApp), pra reconexões não criarem vários loops.
iniciarAgendador(enviar);
