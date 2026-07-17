// Teste isolado do banco (Etapa 1 da skill criar_lembrete).
// Roda em banco de memória (JARBAS_DB=:memory:), sem tocar no arquivo real.
// Uso: npm run testar:db

import { salvarLembrete, lembretesVencidos, marcarAvisado } from "./db.ts";

const agora = Date.now();

// Um lembrete que "já venceu" (1s atrás) e um lá no futuro (daqui 1h).
const destino = "teste@s.whatsapp.net";
salvarLembrete("beber água", agora - 1000, destino);
salvarLembrete("reunião", agora + 60 * 60 * 1000, destino);

// Só o vencido deve aparecer — o futuro não.
const vencidos = lembretesVencidos(agora);
console.log("⏰ vencidos agora:", vencidos.map((l) => l.texto));

// Depois de avisar, ele não pode mais aparecer.
for (const l of vencidos) marcarAvisado(l.id);
console.log(
  "✅ após marcar avisado:",
  lembretesVencidos(agora).map((l) => l.texto),
  "(deve ser lista vazia)",
);
