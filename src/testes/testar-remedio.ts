// Teste do modelo de dados da medicação (Etapa 1 da skill remédio).
// Banco em memória, sem LLM nem cron. Uso: npm run testar:remedio

import {
  salvarRemedio,
  remediosAtivos,
  criarDose,
  doseDoDia,
  marcarDose,
  desativarRemedio,
  remedioAtivoPorNome,
} from "../db.ts";

const destino = "teste@s.whatsapp.net";
const hoje = "2026-07-17";

// 1. Cadastra dois remédios em horários diferentes.
const id1 = salvarRemedio("anticoncepcional", "22:00", destino);
salvarRemedio("vitamina D", "08:00", destino);
console.log(
  "💊 remédios ativos:",
  remediosAtivos().map((r) => `${r.nome} @ ${r.hora}`),
);

// 2. Cria a dose de hoje do 1º remédio (o verificador faria isso no horário).
const doseId = criarDose(id1, destino, hoje);
console.log("📋 dose criada, status:", doseDoDia(id1, hoje)?.status, "(deve ser pendente)");

// 3. Não duplica: pedir a dose do mesmo dia devolve a MESMA (id igual).
console.log("🔁 mesma dose do dia?", doseDoDia(id1, hoje)?.id === doseId, "(deve ser true)");

// 4. Ela confirma → marca como tomada.
marcarDose(doseId, "tomado");
console.log("✅ após confirmar, status:", doseDoDia(id1, hoje)?.status, "(deve ser tomado)");

// 5. "Apaga a vitamina D": acha pelo nome e desativa (soft delete).
const vit = remedioAtivoPorNome("VITAMINA D", destino); // busca ignora maiúsculas
console.log("🔎 achou pelo nome?", vit?.nome, "(deve ser 'vitamina D')");
if (vit) desativarRemedio(vit.id);
console.log(
  "🗑️ ativos após desativar:",
  remediosAtivos().map((r) => r.nome),
  "(deve sobrar só o anticoncepcional)",
);
