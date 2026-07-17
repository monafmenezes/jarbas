// Teste da confirmação de remédio (Etapa 4): "tomei" para a insistência e o
// status reflete isso. Banco em memória, relógio simulado. Uso: npm run testar:confirmar

import { salvarRemedio } from "../db.ts";
import { verificarRemedios } from "../skills/verificar-remedios.ts";
import { ehConfirmacao, confirmarRemedios } from "../skills/confirmar-remedio.ts";
import { statusDeHoje } from "../skills/status-remedios.ts";

const destino = "teste@s.whatsapp.net";
const enviadas: string[] = [];
const enviar = async (_d: string, texto: string) => void enviadas.push(texto);

salvarRemedio("anticoncepcional", "22:00", destino);

const base = new Date("2026-07-17T22:00:00-03:00");
const MIN = 60 * 1000;
const em = (m: number) => new Date(base.getTime() + m * MIN);

// 1. Detecção da palavra-chave (com e sem acento/pontuação; e um falso positivo).
console.log("'Já tomei!' é confirmação?", ehConfirmacao("Já tomei!"), "(deve ser true)");
console.log("'tomei' é confirmação?", ehConfirmacao("tomei"), "(deve ser true)");
console.log("'tomei um café' é confirmação?", ehConfirmacao("tomei um café"), "(deve ser false)");

// 2. Dispara às 22:00 (1 aviso) e confirma.
await verificarRemedios(enviar, em(0));
console.log("\n22:00 → avisos:", enviadas.length, "(deve ser 1)");
console.log("confirmar:", confirmarRemedios(destino, em(2)));

// 3. Às 22:15 NÃO deve reavisar (a dose já foi tomada).
await verificarRemedios(enviar, em(15));
console.log("após confirmar, 22:15 → avisos:", enviadas.length, "(deve continuar 1)");

// 4. Status de hoje reflete "tomado".
console.log("\n" + statusDeHoje(destino, em(15)));

// 5. Confirmar de novo, sem nada pendente.
console.log("\nconfirmar sem pendência:", confirmarRemedios(destino, em(20)));
