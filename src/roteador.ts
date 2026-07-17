// 🚦 O roteador de intenção do Jarbas.
// Recebe um TEXTO (não importa se foi digitado ou transcrito de um áudio),
// pergunta ao cérebro o que a pessoa quer e despacha pra skill certa.
// Devolve a resposta pronta — quem chamou é que decide como/onde enviar.

import type { Brain } from "./brain.ts";
import { acharUrl, baixarTextoDoLink } from "./skills/resumir-link.ts";
import { salvarLembrete, salvarGasto } from "./db.ts";

// `destino` é o JID da conversa: precisamos dele pra guardar o lembrete e o
// agendador saber pra onde mandar o aviso depois.
export async function rotearTexto(
  texto: string,
  brain: Brain,
  destino: string,
): Promise<string> {
  // 1. Pergunta ao cérebro O QUE a pessoa quer.
  const intencao = await brain.classificarIntencao(texto);
  console.log(`💬 "${texto}" → intenção: ${intencao}`);

  // 2. Roteia pra skill certa. Cada destino monta a resposta.
  switch (intencao) {
    case "conversa":
      // Papo livre já funciona de verdade (o "ChatGPT no zap").
      return brain.conversar(texto);

    case "resumir_link": {
      const url = acharUrl(texto);
      if (!url) return "🔗 não achei um link na mensagem. Me manda a URL!";
      try {
        const conteudo = await baixarTextoDoLink(url);
        return "🔗 " + (await brain.resumir(conteudo));
      } catch (erro) {
        // Rede caiu, site fora do ar, timeout... avisa em vez de morrer.
        return `🔗 não consegui resumir: ${(erro as Error).message}`;
      }
    }

    case "criar_lembrete": {
      const lembrete = await brain.extrairLembrete(texto, new Date());
      if (!lembrete) {
        return '⏰ entendi que é um lembrete, mas não peguei a hora. Tenta com um horário, tipo "amanhã às 9h".';
      }
      // Guarda no banco COM o destino (esta conversa) pro agendador achar depois.
      salvarLembrete(lembrete.texto, lembrete.quando, destino);
      const quando = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(lembrete.quando));
      return `⏰ combinado! vou te lembrar de "${lembrete.texto}" em ${quando}.`;
    }

    case "registrar_gasto": {
      const gasto = await brain.extrairGasto(texto);
      if (!gasto) {
        return "💰 entendi que é um gasto, mas não peguei o valor. Tenta assim: \"gastei 45 no mercado\".";
      }
      // Guarda o gasto nesta conversa (destino) pro relatório semanal achar depois.
      salvarGasto(gasto.centavos, gasto.categoria, gasto.descricao, destino);
      // Centavos -> reais só AQUI, na hora de mostrar (o banco continua inteiro).
      const valor = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(gasto.centavos / 100);
      // Só mostra a descrição quando ela acrescenta algo além da categoria
      // (evita o redundante "R$ 45,90 em mercado (mercado)").
      const detalhe =
        gasto.descricao !== gasto.categoria ? ` (${gasto.descricao})` : "";
      return `💰 anotado! ${valor} em ${gasto.categoria}${detalhe}.`;
    }
  }
}
