// 💊 Status dos remédios de HOJE — responde "já tomei hoje?".
// Pra cada remédio ativo, olha se a dose de hoje existe e em que pé está.
// Ataca o segundo medo dela: "tomei e esqueci se tomei".

import { remediosAtivosDe, doseDoDia } from "../db.ts";
import { diaLocal } from "../tempo.ts";

export function statusDeHoje(destino: string, agora: Date = new Date()): string {
  const remedios = remediosAtivosDe(destino);
  if (remedios.length === 0) {
    return "💊 você não tem remédios cadastrados.";
  }
  const dia = diaLocal(agora);
  const linhas = remedios.map((r) => {
    const dose = doseDoDia(r.id, dia);
    // Sem dose ainda = o horário do remédio não chegou hoje.
    if (!dose) return `• ${r.nome} (${r.hora}) — ⏳ ainda não deu a hora`;
    if (dose.status === "tomado") return `• ${r.nome} — ✅ tomado`;
    if (dose.status === "perdido") return `• ${r.nome} — ❌ não confirmado`;
    return `• ${r.nome} — ⏰ pendente (responde "tomei")`;
  });
  return "💊 Seus remédios de hoje:\n\n" + linhas.join("\n");
}
