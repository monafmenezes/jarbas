// Teste isolado da extração de gasto (Etapa 2 da skill registrar_gasto).
// Usa o cérebro/LLM. Uso: npm run testar:gasto

import { OpenAIBrain } from "../brain.ts";

const brain = new OpenAIBrain();

const frases = [
  "gastei 45,90 no mercado",
  "paguei 12 de uber pro trabalho",
  "almoço 32 reais",
  "2 reais de chocolate", // ambíguo → deve virar "alimentação", não "outros"
  "paguei 89 de luz", // conta doméstica → "contas"/"moradia"
  "remédio 27 reais", // → "saúde"
  "que dia é hoje", // sem valor → deve dar null
];

// Formata centavos de volta pra reais, do jeito que a pessoa vê (R$ 45,90).
const emReais = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );

for (const frase of frases) {
  const g = await brain.extrairGasto(frase);
  if (g) {
    console.log(
      `  "${frase}"\n   → ${emReais(g.centavos)} · ${g.categoria} · "${g.descricao}"\n`,
    );
  } else {
    console.log(`  "${frase}"\n   → (não é um gasto)\n`);
  }
}
