// 🧠 O "cérebro" do Jarbas: tudo que precisa de IA mora atrás desta interface.
// Regra de ouro: as skills conversam com o CONTRATO (Brain), nunca com a OpenAI
// direto. Trocar de provedor (OpenAI → Claude) vira: escrever outra classe que
// implemente Brain e mudar UMA linha de montagem. Nada mais no projeto muda.

import OpenAI from "openai";

// O que o usuário quer, decidido pelo cérebro a partir da mensagem dele.
// É a lista de destinos que o roteador do WhatsApp vai saber atender.
export type Intencao =
  | "resumir_link" // mandou um link / pediu pra resumir algo
  | "criar_lembrete" // quer ser lembrado de algo no futuro
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
}

// O que sai da extração de um lembrete: só o essencial (o banco cuida do resto).
export interface LembreteExtraido {
  texto: string; // o que lembrar, já limpo (sem "me lembra de")
  quando: number; // epoch em ms (UTC) — o instante de disparar
}

// Fuso da Monalisa (João Pessoa/PB): UTC-3, e o Brasil não tem mais horário de
// verão, então o offset é fixo. Por isso podemos carimbar "-03:00" com segurança.
const FUSO = "America/Fortaleza";
const OFFSET = "-03:00";

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
            '- "conversa": qualquer outra coisa (pergunta, papo, dúvida geral).',
        },
        { role: "user", content: texto },
      ],
    });

    const bruto = resposta.choices[0]?.message.content ?? "{}";

    // O LLM não é 100% confiável: pode devolver algo fora da lista. Então a
    // gente valida e, na dúvida, cai no destino seguro ("conversa").
    const opcoes = ["resumir_link", "criar_lembrete", "conversa"] as const;
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
            `REGRA IMPORTANTE: se a mensagem NÃO indicar um horário, dia ou prazo, ` +
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
}
