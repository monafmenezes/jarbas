// Teste do "segundo cérebro" (Etapa 5): a matemática do cosseno + o fluxo de
// anotar/consultar. NÃO chama a OpenAI — usa um CÉREBRO FALSO que devolve vetores
// fixos por assunto. Assim o teste é determinístico, grátis e instantâneo, e mede
// a NOSSA lógica (guardar, ranquear, limiar), não o modelo da OpenAI.
// Uso: npm run testar:segundo-cerebro

import type { Brain } from "../brain.ts";
import { cosseno, anotar, consultarMemoria } from "../skills/segundo-cerebro.ts";

// Mini-asserção: quebra o teste (sai com erro) se a condição for falsa.
let passaram = 0;
function ok(condicao: boolean, o_que: string): void {
  if (!condicao) {
    console.error(`❌ FALHOU: ${o_que}`);
    process.exit(1);
  }
  console.log(`✅ ${o_que}`);
  passaram++;
}
// Igualdade "de perto" pra floats (0.1 + 0.2 nunca é exatamente 0.3).
const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ─── 1. A matemática do cosseno (pura, sem banco nem cérebro) ─────────────────
console.log("--- cosseno ---");
ok(perto(cosseno([1, 0, 0], [1, 0, 0]), 1), "vetores iguais → 1 (mesma direção)");
ok(perto(cosseno([1, 0, 0], [0, 1, 0]), 0), "perpendiculares → 0 (sem relação)");
ok(perto(cosseno([1, 0], [10, 0]), 1), "tamanho ≠, direção = → 1 (tamanho não conta!)");
ok(cosseno([1, 0], [0, 0]) === 0, "vetor nulo → 0 (sem divisão por zero)");

// ─── 2. O cérebro FALSO: vetor fixo por assunto ───────────────────────────────
// Só implementamos o método que a skill usa (gerarEmbedding). O resto do contrato
// Brain não é chamado aqui, então o `as unknown as Brain` basta — stub enxuto.
function vetorDe(texto: string): number[] {
  const t = texto.toLowerCase();
  if (t.includes("wifi") || t.includes("senha")) return [1, 0, 0]; // assunto A
  if (t.includes("chave") || t.includes("vizinha")) return [0, 1, 0]; // assunto B
  return [0, 0, 1]; // qualquer outro assunto
}
const brain = {
  gerarEmbedding: async (texto: string) => vetorDe(texto),
} as unknown as Brain;

const d = "teste@s.whatsapp.net";
const vazio = "vazio@s.whatsapp.net";

// ─── 3. Consultar SEM ter anotado nada ────────────────────────────────────────
console.log("\n--- fluxo anotar/consultar ---");
ok(
  (await consultarMemoria("qualquer coisa", brain, vazio)).includes("ainda não"),
  "consulta em conversa vazia → avisa que não tem nada anotado",
);

// ─── 4. Anotar e recuperar por SIGNIFICADO ────────────────────────────────────
await anotar("anota que o wifi novo é 12345", brain, d);
await anotar("guarda que a chave reserva fica com a vizinha", brain, d);

const rWifi = await consultarMemoria("qual a senha do wifi?", brain, d);
ok(rWifi.includes("12345"), "'senha do wifi?' → recupera a nota do wifi (assunto A)");

const rChave = await consultarMemoria("com quem está a chave?", brain, d);
ok(rChave.includes("vizinha"), "'com quem está a chave?' → recupera a nota da chave (assunto B)");

// ─── 5. Pergunta sem relação: o limiar barra ──────────────────────────────────
const rNada = await consultarMemoria("qual meu time de futebol?", brain, d);
ok(rNada.includes("não achei"), "assunto sem nota (cosseno 0 < limiar) → 'não achei'");

console.log(`\n🎉 ${passaram} verificações passaram.`);
