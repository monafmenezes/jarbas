// Teste do verificador de remédios (Etapa 3): dispara no horário, insiste a cada
// 15 min e desiste em ~1h. Banco em memória; o relógio é SIMULADO (passamos o
// `agora`), então não esperamos 1h de verdade. Uso: npm run testar:verificar

import { salvarRemedio, doseDoDia } from "../db.ts";
import { verificarRemedios } from "../skills/verificar-remedios.ts";

const destino = "teste@s.whatsapp.net";

// `enviar` falso: em vez de mandar no WhatsApp, guarda as mensagens numa lista.
const enviadas: string[] = [];
const enviar = async (_destino: string, texto: string) => {
  enviadas.push(texto);
};

// Remédio das 22:00.
const remedioId = salvarRemedio("anticoncepcional", "22:00", destino);

const base = new Date("2026-07-17T22:00:00-03:00");
const MIN = 60 * 1000;
const em = (min: number) => new Date(base.getTime() + min * MIN);

// 21:59 — antes da hora: não dispara nada.
await verificarRemedios(enviar, em(-1));
console.log("21:59 →", enviadas.length, "aviso(s) (deve ser 0)");

// 22:00 — dispara o 1º aviso.
await verificarRemedios(enviar, em(0));
console.log("22:00 →", enviadas.length, "aviso(s) (deve ser 1)");

// +15/+30/+45 — insiste (mais 3 avisos).
for (const m of [15, 30, 45]) await verificarRemedios(enviar, em(m));
console.log("+15/+30/+45 →", enviadas.length, "aviso(s) no total (deve ser 4)");

// +60 — desiste: nenhum aviso novo, e a dose vira 'perdido'.
await verificarRemedios(enviar, em(60));
console.log("+60 →", enviadas.length, "aviso(s) (deve continuar 4)");
console.log(
  "status da dose:",
  doseDoDia(remedioId, "2026-07-17")?.status,
  "(deve ser perdido)",
);

console.log("\n--- mensagens enviadas ---");
enviadas.forEach((m, i) => console.log(`${i + 1}. ${m}`));
