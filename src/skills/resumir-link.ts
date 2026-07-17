// Skill: baixar o conteúdo de uma URL e devolver só o texto legível.
// (O resumo em si é feito depois pelo cérebro — aqui a gente só "vai buscar".)

import * as cheerio from "cheerio";

// Textos gigantes custam muitos tokens e raramente melhoram o resumo. Cortamos.
const LIMITE_CARACTERES = 8000;

// Acha a primeira URL (http/https) dentro de um texto. `null` se não houver.
export function acharUrl(texto: string): string | null {
  const achado = texto.match(/https?:\/\/[^\s]+/);
  return achado ? achado[0] : null;
}

// Baixa a página e extrai só o conteúdo de leitura (sem scripts, menu, rodapé).
export async function baixarTextoDoLink(url: string): Promise<string> {
  const resp = await fetch(url, {
    // Alguns sites bloqueiam quem não parece um navegador.
    headers: { "user-agent": "Mozilla/5.0 (compatible; JarbasBot/1.0)" },
    // Não deixamos o bot travar pra sempre esperando uma página lenta.
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    throw new Error(`não consegui abrir o link (HTTP ${resp.status})`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Guardamos o título antes de podar — ele dá contexto pro resumo.
  const titulo = $("title").first().text().trim();

  // Fora o que não é conteúdo de leitura.
  $("script, style, noscript, nav, header, footer, svg, iframe").remove();

  // Pega o texto do corpo e normaliza a "sopa" de espaços/quebras.
  const corpo = $("body").text().replace(/\s+/g, " ").trim();

  const texto = titulo ? `Título: ${titulo}\n\n${corpo}` : corpo;
  return texto.slice(0, LIMITE_CARACTERES);
}
