// 🧠 Segundo cérebro: "anota que…" guarda uma nota; "o que eu falei sobre…" acha
// a nota por SIGNIFICADO (não por palavra exata). O truque é o embedding (Etapa 2):
// cada nota vira um vetor; a busca vira "achar o vetor mais parecido com a pergunta".

import type { Brain } from "../brain.ts";
import { salvarNota, notasDe, type Nota } from "../db.ts";

// Quão parecidos são dois vetores, de 0 (nada a ver) a 1 (mesmo sentido). É a
// SIMILARIDADE DE COSSENO: mede o ÂNGULO entre os vetores, não o tamanho deles.
// Dois textos do mesmo assunto "apontam pra mesma direção" → cosseno perto de 1.
//   cos = (a·b) / (|a| · |b|)
//   a·b   = soma dos produtos par a par (o "produto escalar")
//   |a|   = tamanho do vetor = raiz da soma dos quadrados
// Fazemos tudo num laço só: acumula o produto e os dois tamanhos ao mesmo tempo.
export function cosseno(a: number[], b: number[]): number {
  let produto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    // `?? 0`: o TS trata a[i] como "pode ser undefined" (índice fora do array).
    // Aqui i está sempre dentro, mas o `?? 0` satisfaz o compilador sem risco.
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    produto += ai * bi;
    normaA += ai * ai;
    normaB += bi * bi;
  }
  const denominador = Math.sqrt(normaA) * Math.sqrt(normaB);
  // Vetor de tamanho zero não tem direção — evita divisão por zero.
  return denominador === 0 ? 0 : produto / denominador;
}

// Abaixo deste valor, consideramos que a nota "não tem a ver" com a pergunta.
// É um botão de sensibilidade: alto demais perde respostas válidas; baixo demais
// devolve nota irrelevante. 0.35 separou bem nos testes (relevante ~0.6, longe ~0.17).
const LIMIAR = 0.35;

// Tira o gatilho do começo ("anota que…", "guarda que…") pra guardar só o miolo
// da nota. Se não houver gatilho, guarda o texto inteiro. É de propósito SEM IA:
// uma limpeza simples de texto não precisa de um modelo (igual ao atalho "tomei").
function limparNota(texto: string): string {
  const semGatilho = texto
    .trim()
    .replace(/^(anota(r|\s+a[ií])?|guarda|lembra)\s*(que|isso|aí|ai)?\s*[:,-]?\s*/i, "");
  // Se a limpeza comeu tudo (a pessoa mandou só "anota"), volta ao texto original.
  return semGatilho.trim() || texto.trim();
}

// "anota que o wifi novo é 12345" → gera o embedding da nota e guarda no banco.
export async function anotar(
  texto: string,
  brain: Brain,
  destino: string,
): Promise<string> {
  const nota = limparNota(texto);
  if (!nota) return "🧠 o que você quer que eu anote?";

  // O significado da nota vira vetor (Etapa 2) e é guardado junto do texto (Etapa 1).
  const embedding = await brain.gerarEmbedding(nota);
  salvarNota(nota, embedding, destino);
  return `🧠 anotado! Depois é só perguntar que eu lembro. 😉`;
}

// "qual a senha do wifi?" → acha a nota guardada mais parecida com a pergunta.
export async function consultarMemoria(
  pergunta: string,
  brain: Brain,
  destino: string,
): Promise<string> {
  const notas = notasDe(destino);
  if (notas.length === 0) {
    return "🧠 ainda não tenho nada anotado. Me manda um \"anota que…\" primeiro!";
  }

  // A pergunta também vira vetor — pra comparar "maçã com maçã" (vetor com vetor).
  const alvo = await brain.gerarEmbedding(pergunta);

  // Mede a similaridade da pergunta com CADA nota e fica com a mais parecida.
  // (Comparação no JS porque o SQLite não sabe medir distância entre vetores.)
  let melhor: Nota | null = null;
  let melhorScore = -Infinity;
  for (const nota of notas) {
    const score = cosseno(alvo, nota.embedding);
    if (score > melhorScore) {
      melhor = nota;
      melhorScore = score;
    }
  }

  // Se nem a mais parecida passou do limiar, é porque não tem nada sobre o assunto.
  if (!melhor || melhorScore < LIMIAR) {
    return "🧠 não achei nada anotado sobre isso.";
  }
  return `🧠 ${melhor.texto}`;
}
