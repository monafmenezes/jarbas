// 🍽️ Skill de calorias: recebe a FOTO de uma refeição, pede ao cérebro a
// estimativa (prato + itens + total) e monta a resposta do WhatsApp.
// Segue o mesmo padrão das outras skills: fala com o CONTRATO Brain (nunca com
// a OpenAI direto) e devolve texto pronto — quem envia é o núcleo (whatsapp.ts).

import type { Brain } from "../brain.ts";

// Recebe os bytes crus da foto + o cérebro, e devolve a mensagem já formatada.
// O null do cérebro (imagem que não parece comida) vira uma resposta gentil
// aqui: a pessoa mandou uma foto, então merece um retorno — nunca silêncio.
export async function estimarCaloriasDaFoto(
  imagem: Uint8Array,
  brain: Brain,
): Promise<string> {
  const refeicao = await brain.estimarRefeicao(imagem);
  if (!refeicao) {
    return "🍽️ não reconheci uma refeição nessa foto. Manda uma foto do prato que eu estimo as calorias! 😋";
  }

  // Uma linha por item ("• arroz branco: ~240 kcal"). O "~" deixa explícito
  // pra pessoa que o número é ESTIMATIVA, não uma medida cravada.
  const linhas = refeicao.itens.map((i) => `• ${i.nome}: ~${i.calorias} kcal`);

  // Pode acontecer de o cérebro reconhecer a comida mas não destrinchar os
  // itens: nesse caso mostramos só o prato + total, sem uma lista vazia solta.
  const corpo = linhas.length > 0 ? "\n\n" + linhas.join("\n") : "";

  return (
    `🍽️ ${refeicao.prato}${corpo}\n\n` +
    `🔥 Total estimado: ~${refeicao.calorias} kcal`
  );
}
