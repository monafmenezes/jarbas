# Jarbas 🤵

> Assistente pessoal **modular** no WhatsApp — um mordomo digital que salva links,
> transcreve áudios, cuida das suas finanças e até estima as calorias do seu prato
> por foto.

![status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white)

🚧 **Projeto em desenvolvimento ativo.** O esqueleto está de pé e as _skills_ estão
sendo construídas uma a uma. Acompanhe o progresso no roadmap abaixo.

## A ideia

Em vez de vários bots separados (cada um com a mesma dor de conectar no WhatsApp,
guardar sessão e tratar mídia), o Jarbas é **um núcleo único** — conexão + roteador
de intenção — com _skills_ plugadas. Adicionar uma capacidade nova é adicionar um
módulo, não um bot inteiro.

```
        ┌─────────────────────────┐
 msg ──▶│   Núcleo (WhatsApp +     │
        │   roteador de intenção)  │
        └───────────┬─────────────┘
                    │
      ┌─────────────┼──────────────┐
      ▼             ▼              ▼
 📝 Assistente  💰 Financeiro   🍽️ Calorias   … ＋ novas skills
```

Cada skill é um módulo plugável — assistente, financeiro, calorias, devocional, bem-estar,
corrida, estudo, ciclo menstrual e por aí vai. É só ir adicionando (veja o roadmap logo abaixo).

## Roadmap

### Em construção (ordem de build)

- [x] **Fase 0 — Setup** · esqueleto TypeScript rodando
- [ ] **Fase 1 — 📝 Assistente** · salvar/resumir link, transcrever áudio, criar lembrete
- [ ] **Fase 2 — 💰 Financeiro** · "gastei 45 no mercado" → categoriza, guarda e manda relatório semanal
  - _evoluções previstas:_ corrigir/atualizar um gasto já lançado · listar os gastos do dia ("quanto gastei hoje?")
- [ ] **Fase 3 — 🍽️ Calorias** · foto da refeição → estima o prato e as calorias

### No radar (backlog de skills)

**🤖 Assistente & produtividade**
- [ ] 💬 **Pergunta livre** · qualquer dúvida respondida na hora, tipo um ChatGPT no zap
- [ ] 🧠 **Segundo cérebro** · "anota que…" / "o que eu falei sobre X?" (busca semântica)
- [ ] ⏱️ **Foco & estudo** · Pomodoro e registro de horas por matéria, meta semanal
- [ ] 🃏 **Flashcards** · revisão espaçada (SM-2) — "me pergunta sobre X"
- [ ] 🛒 **Lista de compras** · vai acumulando itens e monta a lista
- [ ] 🎂 **Aniversários** · lembra de datas e até sugere a mensagem
- [ ] 📅 **Agenda** · criar eventos por linguagem natural (Google Calendar)

**❤️ Bem-estar & saúde**
- [ ] 🌱 **Bem-estar** · check-in diário de humor/gratidão com tendências
- [ ] 💊 **Medicação** · registra remédio e avisa na hora
- [ ] 🌸 **Ciclo menstrual** · registra o ciclo, prevê menstruação/período fértil e avisa
- [ ] 🏃 **Corrida** · previsão do tempo pra treino e registro de corridas
- [ ] 🍳 **O que cozinhar** · "tenho ovo, tomate e arroz" → sugestões de receita

**🙏 Fé**
- [ ] 🙏 **Devocional** · evangelho/liturgia do dia toda manhã, com uma reflexão curta
- [ ] 📿 **Terço & santo do dia** · lembrete de oração e sequência guiada do terço

**🔗 Ponte com outros projetos & automação**
- [ ] 🎯 **Preparação pra vaga** · cola a descrição → perguntas de entrevista, match com o currículo
- [ ] 📦 **Rastreamento de encomenda** · código dos Correios → status, avisa quando mexer
- [ ] 💱 **Cotação & alertas** · dólar, euro, cripto sob demanda ou com alerta de preço

**✨ Extras**
- [ ] 🔊 **Resposta em áudio (TTS)** · o Jarbas responde falando, não só escrevendo

## Stack

- **TypeScript** + [`tsx`](https://github.com/privatenumber/tsx)
- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp (não-oficial), num número dedicado
- **`node:sqlite`** nativo (Node 22.5+) — sem build nativo
- **cron** — lembretes e relatórios
- **OpenAI** (`gpt-4o` + Whisper) — resumo, intenção, transcrição de áudio e visão
  _(atrás de uma interface — trocável por outro provedor sem mexer no resto)_

## Rodar

```bash
npm install
npm run dev
```

> ⚠️ O Baileys conecta lendo um QR code como se fosse o WhatsApp Web. Use um
> **número secundário/dedicado** para o Jarbas — nunca o seu número pessoal em
> produção.

---

Feito por [Monalisa Menezes](https://github.com/monafmenezes) 💜
