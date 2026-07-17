// Teste isolado da extração de texto de um link (Etapa 1 da skill resumir_link).
// Não usa o cérebro/LLM — só baixa e mostra um trecho. Uso: npm run testar:link

import { acharUrl, baixarTextoDoLink } from "../skills/resumir-link.ts";

const mensagem = "resume isso pra mim: https://pt.wikipedia.org/wiki/WebSocket";

const url = acharUrl(mensagem);
console.log("🔎 URL encontrada na mensagem:", url, "\n");

if (!url) {
  console.log("Nenhuma URL na mensagem.");
} else {
  const texto = await baixarTextoDoLink(url);
  console.log(`📥 Baixados ${texto.length} caracteres. Primeiros 500:\n`);
  console.log(texto.slice(0, 500) + "...");
}
