// Teste isolado da skill de calorias (Etapa 2 da Fase 3 — Calorias).
// Usa o cérebro/LLM DE VERDADE com visão, então precisa da OPENAI_API_KEY.
// Como a entrada é uma foto, você passa o caminho de uma imagem de refeição:
//   npm run testar:calorias -- ./minha-comida.jpg

import { readFileSync } from "node:fs";
import { OpenAIBrain } from "../brain.ts";
import { estimarCaloriasDaFoto } from "../skills/estimar-calorias.ts";

// O caminho da foto vem como argumento (o que estiver depois do "--").
const caminho = process.argv[2];
if (!caminho) {
  console.error(
    "❌ passe o caminho de uma foto de refeição:\n" +
      "   npm run testar:calorias -- ./minha-comida.jpg",
  );
  process.exit(1);
}

const brain = new OpenAIBrain();
// readFileSync devolve um Buffer, que JÁ é um Uint8Array — serve direto pra skill.
const bytes = readFileSync(caminho);

console.log(`📷 analisando ${caminho}...\n`);
const resposta = await estimarCaloriasDaFoto(bytes, brain);
console.log(resposta);
