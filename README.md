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
 📝 Assistente  💰 Financeiro   🍽️ Calorias
```

## Roadmap

- [x] **Fase 0 — Setup** · esqueleto TypeScript rodando
- [ ] **Fase 1 — 📝 Assistente** · salvar/resumir link, transcrever áudio, criar lembrete
- [ ] **Fase 2 — 💰 Financeiro** · "gastei 45 no mercado" → categoriza, guarda e manda relatório semanal
- [ ] **Fase 3 — 🍽️ Calorias** · foto da refeição → estima o prato e as calorias

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
