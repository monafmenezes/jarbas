// 🧠 O "cérebro" do Jarbas: tudo que precisa de IA mora atrás desta interface.
// Regra de ouro: as skills conversam com o CONTRATO (Brain), nunca com a OpenAI
// direto. Trocar de provedor (OpenAI → Claude) vira: escrever outra classe que
// implemente Brain e mudar UMA linha de montagem. Nada mais no projeto muda.

import OpenAI, { toFile } from "openai";
import { FUSO, OFFSET } from "./tempo.ts";

// O que o usuário quer, decidido pelo cérebro a partir da mensagem dele.
// É a lista de destinos que o roteador do WhatsApp vai saber atender.
export type Intencao =
  | "resumir_link" // mandou um link / pediu pra resumir algo
  | "criar_lembrete" // quer ser lembrado de algo no futuro
  | "registrar_gasto" // está anotando um gasto ("gastei 45 no mercado")
  | "consultar_gastos" // quer SABER quanto/no que gastou ("quanto gastei hoje?")
  | "cadastrar_remedio" // quer ser lembrada de um remédio recorrente
  | "remover_remedio" // quer PARAR de ser lembrada de um remédio
  | "listar_remedios" // quer VER a lista de remédios cadastrados
  | "consultar_remedios" // quer saber se JÁ TOMOU hoje ("já tomei o remédio?")
  | "conversa"; // qualquer outra coisa: papo livre, pergunta, dúvida

// ─── O CONTRATO ──────────────────────────────────────────────────────────────
// O que o cérebro sabe fazer. Os demais métodos (transcrever, verFoto) entram
// nas próximas fases.
export interface Brain {
  // Recebe um texto qualquer e devolve um resumo curto em português.
  resumir(texto: string): Promise<string>;
  // Lê a mensagem e decide qual skill deve atendê-la.
  classificarIntencao(texto: string): Promise<Intencao>;
  // Responde uma mensagem livre, como um chat comum (o "ChatGPT no zap").
  conversar(texto: string): Promise<string>;
  // Lê um pedido de lembrete e extrai O QUÊ lembrar e QUANDO (epoch em ms).
  // Devolve null se não der pra entender a hora. `agora` é a referência de tempo.
  extrairLembrete(texto: string, agora: Date): Promise<LembreteExtraido | null>;
  // Lê um registro de gasto ("gastei 45,90 no mercado") e extrai quanto, em que
  // categoria e a descrição. Devolve null se não der pra achar um valor.
  extrairGasto(texto: string): Promise<GastoExtraido | null>;
  // Lê um cadastro de remédio ("tomo o anticoncepcional todo dia às 22h") e
  // extrai o nome e a hora ("HH:MM"). Devolve null se não der pra achar a hora.
  extrairRemedio(texto: string): Promise<RemedioExtraido | null>;
  // Lê um pedido de remoção ("para de me lembrar da vitamina D") e extrai só o
  // nome do remédio. Devolve null se não achar um nome.
  extrairNomeRemedio(texto: string): Promise<string | null>;
  // Recebe os bytes crus de um áudio (OGG/Opus, como o WhatsApp manda) e
  // devolve o texto falado — transcrição de voz pra texto.
  transcrever(audio: Uint8Array): Promise<string>;
}

// O que sai da extração de um lembrete: só o essencial (o banco cuida do resto).
export interface LembreteExtraido {
  texto: string; // o que lembrar, já limpo (sem "me lembra de")
  quando: number; // epoch em ms (UTC) — o instante de disparar
}

// O que sai da extração de um gasto. `centavos` já vem inteiro (o cérebro
// raciocina em reais, mas a gente converte na saída pra manter a regra do banco:
// dinheiro sempre em centavos). Ver a interface Gasto em db.ts.
export interface GastoExtraido {
  centavos: number; // R$ 45,90 -> 4590
  categoria: string; // uma das CATEGORIAS abaixo
  descricao: string; // o texto do que foi comprado ("mercado", "uber")
}

// O que sai da extração de um cadastro de remédio.
export interface RemedioExtraido {
  nome: string; // "anticoncepcional", "vitamina D"
  hora: string; // "HH:MM" local, ex.: "22:00"
}

// Lista fechada de categorias. Manter fixa faz o relatório somar direito (sem
// "mercado" e "supermercado" virando dois baldes diferentes). O cérebro é
// instruído a escolher SEMPRE uma destas — na dúvida, "outros".
export const CATEGORIAS = [
  "mercado",
  "alimentação",
  "transporte",
  "moradia",
  "contas",
  "saúde",
  "lazer",
  "compras",
  "outros",
] as const;

// Modelo padrão das chamadas. gpt-4o-mini é barato e mais que suficiente pra
// resumo e classificação de intenção. Se um dia uma tarefa exigir mais (ex.:
// visão em foto de refeição), dá pra subir pra "gpt-4o" só naquele método.
const MODELO = "gpt-4o-mini";

// ─── A IMPLEMENTAÇÃO (OpenAI) ────────────────────────────────────────────────
export class OpenAIBrain implements Brain {
  private client: OpenAI;

  constructor() {
    // A chave vem do ambiente (carregado do .env). Falha cedo e com mensagem
    // clara se ela não existir — melhor que um erro obscuro lá na frente.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Falta OPENAI_API_KEY no .env — copie de .env.example e preencha.",
      );
    }
    this.client = new OpenAI({ apiKey });
  }

  async resumir(texto: string): Promise<string> {
    // Uma chamada de "chat": mandamos duas mensagens.
    //  - system: o "crachá" do modelo, define COMO ele deve se comportar.
    //  - user:   o pedido em si (o texto a resumir).
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      messages: [
        {
          role: "system",
          content:
            "Você resume textos em português do Brasil. Seja fiel ao conteúdo, " +
            "claro e breve: no máximo 3 frases. Nunca invente informação.",
        },
        { role: "user", content: `Resuma o texto a seguir:\n\n${texto}` },
      ],
    });

    // A API devolve uma lista de "choices" (respostas candidatas). Pedimos uma
    // só, então pegamos a primeira e o texto dela.
    return resposta.choices[0]?.message.content?.trim() ?? "(sem resumo)";
  }

  async classificarIntencao(texto: string): Promise<Intencao> {
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      // Força a resposta a ser um JSON válido — assim o código consegue parsear
      // sem o modelo "enrolar" com frases em volta.
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você classifica a intenção da mensagem de um assistente pessoal. " +
            'Responda APENAS um JSON no formato {"intencao": "..."}, onde ' +
            "intencao é EXATAMENTE uma destas opções:\n" +
            '- "resumir_link": a mensagem tem um link ou pede pra resumir algo.\n' +
            '- "criar_lembrete": a pessoa quer ser lembrada de algo no futuro.\n' +
            '- "registrar_gasto": a pessoa está anotando um gasto/compra que JÁ ' +
            'aconteceu, com um valor em dinheiro (ex.: "gastei 45 no mercado", ' +
            '"paguei 12 de uber", "almoço 32 reais").\n' +
            '- "consultar_gastos": a pessoa quer SABER quanto ou no que já gastou, ' +
            'SEM informar um valor novo (ex.: "quanto gastei hoje?", "meus gastos de ' +
            'hoje", "quanto já torrei hoje").\n' +
            '- "cadastrar_remedio": a pessoa quer passar a ser lembrada de um ' +
            'REMÉDIO recorrente (todo dia), com nome e horário (ex.: "tomo o ' +
            'anticoncepcional todo dia às 22h", "me lembra de tomar vitamina D às 8h").\n' +
            '- "remover_remedio": a pessoa quer PARAR de ser lembrada de um remédio ' +
            '(ex.: "para de me lembrar da vitamina D", "não tomo mais o antibiótico", ' +
            '"apaga o omeprazol").\n' +
            '- "listar_remedios": a pessoa quer VER quais remédios cadastrou ' +
            '(ex.: "quais remédios eu tomo?", "meus remédios", "lista os remédios").\n' +
            '- "consultar_remedios": a pessoa quer saber se JÁ TOMOU o remédio hoje ' +
            'ou o que falta tomar (ex.: "já tomei o remédio hoje?", "tomei meus ' +
            'remédios?", "o que falta tomar hoje?").\n' +
            '- "conversa": qualquer outra coisa (pergunta, papo, dúvida geral).',
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";

    // O LLM não é 100% confiável: pode devolver algo fora da lista. Então a
    // gente valida e, na dúvida, cai no destino seguro ("conversa").
    const opcoes = [
      "resumir_link",
      "criar_lembrete",
      "registrar_gasto",
      "consultar_gastos",
      "cadastrar_remedio",
      "remover_remedio",
      "listar_remedios",
      "consultar_remedios",
      "conversa",
    ] as const;
    const intencao: unknown = JSON.parse(bruto)?.intencao;
    return (opcoes as readonly unknown[]).includes(intencao)
      ? (intencao as Intencao)
      : "conversa";
  }

  async conversar(texto: string): Promise<string> {
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      messages: [
        {
          role: "system",
          content:
            "Você é o Jarbas, assistente pessoal da Monalisa que responde pelo " +
            "WhatsApp. Fale em português do Brasil, de forma simpática, direta e " +
            "curta — como numa conversa de mensagem, sem textões.",
        },
        { role: "user", content: texto },
      ],
    });
    return (
      resposta.choices[0]?.message.content?.trim() ??
      "🤔 não consegui pensar numa resposta agora."
    );
  }

  async extrairLembrete(
    texto: string,
    agora: Date,
  ): Promise<LembreteExtraido | null> {
    // Descreve "agora" no fuso da Monalisa pra dar ao modelo a referência de tempo.
    const agoraLocal = new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO,
      dateStyle: "full",
      timeStyle: "short",
    }).format(agora);

    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Você extrai lembretes de mensagens. Agora é ${agoraLocal} ` +
            `(fuso ${FUSO}, UTC${OFFSET}). Responda APENAS um JSON no formato ` +
            `{"texto": "...", "quando": "..."} onde:\n` +
            `- texto: o que lembrar, curto e sem "me lembra de" (ex.: "pagar o boleto").\n` +
            `- quando: a data e hora LOCAL do disparo no formato "AAAA-MM-DDTHH:MM", ` +
            `calculada a partir de "agora".\n` +
            `REGRA IMPORTANTE: se a mensagem NÃO indicar um h
            orário, dia ou prazo, ` +
            `"quando" DEVE ser null. Nunca use o horário atual como padrão nem invente uma hora.\n` +
            `Exemplos:\n` +
            `"me lembra de comprar pão" -> {"texto":"comprar pão","quando":null}\n` +
            `"me lembra de pagar amanhã às 9h" -> {"texto":"pagar","quando":"<amanhã>T09:00"}`,
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";
    const dados = JSON.parse(bruto) as { texto?: unknown; quando?: unknown };
    if (typeof dados.texto !== "string" || typeof dados.quando !== "string") {
      return null; // o modelo não conseguiu identificar o quê ou o quando
    }

    // O código faz a conta (o LLM só raciocinou o calendário): carimba o fuso
    // dela no horário local e converte pra epoch. Assim independe do fuso do servidor.
    const quando = new Date(`${dados.quando}${OFFSET}`).getTime();
    if (Number.isNaN(quando)) return null;

    return { texto: dados.texto, quando };
  }

  async extrairGasto(texto: string): Promise<GastoExtraido | null> {
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Você extrai gastos de mensagens de um app financeiro. Responda ` +
            `APENAS um JSON no formato {"valor": ..., "categoria": "...", "descricao": "..."} onde:\n` +
            `- valor: o valor em REAIS como número (use ponto decimal). Ex.: "45,90" -> 45.9.\n` +
            `- categoria: EXATAMENTE uma destas: ${CATEGORIAS.join(", ")}.\n` +
            `- descricao: o que foi comprado, curto (ex.: "mercado", "uber pro trabalho").\n` +
            `COMO ESCOLHER A CATEGORIA (use "outros" só quando NENHUMA encaixar):\n` +
            `- comida, bebida, doce, lanche, refeição fora, ifood, restaurante -> "alimentação"\n` +
            `- compras de supermercado/feira em geral -> "mercado"\n` +
            `- uber, ônibus, gasolina, passagem -> "transporte"\n` +
            `- aluguel, luz, água, internet, telefone -> "contas" ou "moradia"\n` +
            `- remédio, farmácia, consulta -> "saúde"\n` +
            `- cinema, bar, show, jogo, streaming -> "lazer"\n` +
            `- roupa, eletrônico, presente -> "compras"\n` +
            `REGRA IMPORTANTE: se a mensagem NÃO tiver um valor em dinheiro, "valor" DEVE ser null.\n` +
            `Exemplos:\n` +
            `"gastei 45,90 no mercado" -> {"valor":45.9,"categoria":"mercado","descricao":"mercado"}\n` +
            `"paguei 12 de uber pro trabalho" -> {"valor":12,"categoria":"transporte","descricao":"uber pro trabalho"}\n` +
            `"2 reais de chocolate" -> {"valor":2,"categoria":"alimentação","descricao":"chocolate"}\n` +
            `"que dia é hoje" -> {"valor":null,"categoria":"outros","descricao":""}`,
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";
    const dados = JSON.parse(bruto) as {
      valor?: unknown;
      categoria?: unknown;
      descricao?: unknown;
    };

    // Sem valor numérico (ou zero/negativo), não é um gasto que dê pra registrar.
    if (typeof dados.valor !== "number" || !(dados.valor > 0)) return null;

    // A conta acontece AQUI, no código: reais -> centavos inteiros. Math.round
    // evita o lixo de float (45.9 * 100 daria 4589.999... sem o round).
    const centavos = Math.round(dados.valor * 100);

    // O modelo pode escorregar e mandar categoria fora da lista: validamos e,
    // na dúvida, caímos em "outros" — o relatório nunca fica com balde estranho.
    const categoria = (CATEGORIAS as readonly unknown[]).includes(dados.categoria)
      ? (dados.categoria as string)
      : "outros";

    const descricao =
      typeof dados.descricao === "string" && dados.descricao.trim()
        ? dados.descricao.trim()
        : categoria; // se vier vazia, a própria categoria já descreve

    return { centavos, categoria, descricao };
  }

  async extrairRemedio(texto: string): Promise<RemedioExtraido | null> {
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Você cadastra lembretes de remédio. Responda APENAS um JSON no ` +
            `formato {"nome": "...", "hora": "..."} onde:\n` +
            `- nome: o nome do remédio, curto e sem "tomo"/"me lembra" (ex.: "anticoncepcional").\n` +
            `- hora: o horário diário no formato 24h "HH:MM" (ex.: "22:00", "08:00").\n` +
            `REGRA: se a mensagem NÃO indicar um horário, "hora" DEVE ser null.\n` +
            `Exemplos:\n` +
            `"tomo o anticoncepcional todo dia às 22h" -> {"nome":"anticoncepcional","hora":"22:00"}\n` +
            `"me lembra de tomar vitamina D às 8 da manhã" -> {"nome":"vitamina D","hora":"08:00"}\n` +
            `"tomo dipirona" -> {"nome":"dipirona","hora":null}`,
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";
    const dados = JSON.parse(bruto) as { nome?: unknown; hora?: unknown };

    // Precisa de nome E de uma hora no formato "HH:MM" (validamos com regex —
    // a saída do LLM é "texto de estranho" até provar que está no formato certo).
    if (typeof dados.nome !== "string" || !dados.nome.trim()) return null;
    if (typeof dados.hora !== "string" || !/^\d{2}:\d{2}$/.test(dados.hora)) {
      return null;
    }

    return { nome: dados.nome.trim(), hora: dados.hora };
  }

  async extrairNomeRemedio(texto: string): Promise<string | null> {
    const resposta = await this.client.chat.completions.create({
      model: MODELO,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `A pessoa quer PARAR de ser lembrada de um remédio. Extraia só o nome ` +
            `do remédio. Responda APENAS um JSON {"nome": "..."} (nome null se não achar).\n` +
            `Exemplos:\n` +
            `"para de me lembrar da vitamina D" -> {"nome":"vitamina D"}\n` +
            `"não tomo mais o antibiótico" -> {"nome":"antibiótico"}\n` +
            `"apaga o omeprazol" -> {"nome":"omeprazol"}`,
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";
    const dados = JSON.parse(bruto) as { nome?: unknown };
    if (typeof dados.nome !== "string" || !dados.nome.trim()) return null;
    return dados.nome.trim();
  }

  async transcrever(audio: Uint8Array): Promise<string> {
    // A API do Whisper espera um "arquivo", não bytes soltos. `toFile` embrulha
    // os bytes num arquivo em memória (sem tocar no disco). O nome com extensão
    // .ogg é o que diz ao Whisper o formato — é o que o WhatsApp manda.
    const arquivo = await toFile(audio, "audio.ogg", { type: "audio/ogg" });

    // language: "pt" ajuda o modelo a não errar palavra achando que é outro
    // idioma. É a única tarefa que usa o Whisper (não o modelo de chat).
    const resposta = await this.client.audio.transcriptions.create({
      file: arquivo,
      model: "whisper-1",
      language: "pt",
    });

    return resposta.text.trim();
  }
}
