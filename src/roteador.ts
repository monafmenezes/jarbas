// 🚦 O roteador de intenção do Jarbas.
// Recebe um TEXTO (não importa se foi digitado ou transcrito de um áudio),
// pergunta ao cérebro o que a pessoa quer e despacha pra skill certa.
// Devolve a resposta pronta — quem chamou é que decide como/onde enviar.

import type { Brain } from "./brain.ts";
import { acharUrl, baixarTextoDoLink } from "./skills/resumir-link.ts";
import {
  salvarLembrete,
  salvarGasto,
  salvarRemedio,
  remedioAtivoPorNome,
  desativarRemedio,
  jaCadastrado,
} from "./db.ts";
import { extratoDeHoje } from "./skills/consultar-gastos.ts";
import { consumoDeHoje } from "./skills/resumo-calorias.ts";
import { listaDeRemedios } from "./skills/listar-remedios.ts";
import { ehConfirmacao, confirmarRemedios } from "./skills/confirmar-remedio.ts";
import { statusDeHoje } from "./skills/status-remedios.ts";

// `destino` é o JID da conversa: precisamos dele pra guardar o lembrete e o
// agendador saber pra onde mandar o aviso depois.
export async function rotearTexto(
  texto: string,
  brain: Brain,
  destino: string,
): Promise<string> {
  // 0. ATALHO: "tomei" é confirmação por palavra-chave. Checamos ANTES do cérebro
  //    — é instantâneo, robusto e não gasta uma chamada de IA (decisão dela).
  if (ehConfirmacao(texto)) {
    console.log(`💬 "${texto}" → confirmação de remédio`);
    return confirmarRemedios(destino);
  }

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

    case "consultar_gastos":
      // Só lê e resume o que já está no banco — sem cérebro, sem efeito colateral.
      return extratoDeHoje(destino);

    case "cadastrar_remedio": {
      const remedio = await brain.extrairRemedio(texto);
      if (!remedio) {
        return '💊 entendi que é um remédio, mas não peguei o horário. Tenta assim: "tomo o anticoncepcional todo dia às 22h".';
      }
      // Não duplica: mesmo remédio no mesmo horário já cadastrado é ignorado.
      if (jaCadastrado(remedio.nome, remedio.hora, destino)) {
        return `💊 o ${remedio.nome} das ${remedio.hora} já está na sua lista. 😉`;
      }
      salvarRemedio(remedio.nome, remedio.hora, destino);
      return `💊 anotado! vou te lembrar de tomar ${remedio.nome} todo dia às ${remedio.hora}. Quando tomar, é só responder "tomei".`;
    }

    case "remover_remedio": {
      const nome = await brain.extrairNomeRemedio(texto);
      if (!nome) {
        return '💊 não entendi qual remédio você quer parar. Tenta: "para de me lembrar da vitamina D".';
      }
      // Acha o remédio ativo pelo nome (busca ignora maiúsculas) e desliga.
      const remedio = remedioAtivoPorNome(nome, destino);
      if (!remedio) {
        return `💊 não achei nenhum remédio ativo chamado "${nome}".`;
      }
      desativarRemedio(remedio.id);
      return `💊 ok! parei de te lembrar de ${remedio.nome}. 👍`;
    }

    case "listar_remedios":
      // Só lê e formata a lista — sem cérebro.
      return listaDeRemedios(destino);

    case "consultar_remedios":
      // "já tomei hoje?" — mostra o status das doses do dia.
      return statusDeHoje(destino);

    case "consultar_calorias":
      // "quantas calorias comi hoje?" — só lê e soma as refeições do dia,
      // sem cérebro nem efeito colateral (igual ao consultar_gastos).
      return consumoDeHoje(destino);
  }
}
