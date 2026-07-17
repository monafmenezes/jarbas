# Jarbas 🤵

Assistente pessoal **modular** no WhatsApp. Um núcleo único (conexão + roteador de
intenção) com _skills_ plugadas — em vez de vários bots separados.

## Stack

- **TypeScript** + [`tsx`](https://github.com/privatenumber/tsx)
- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp (não-oficial), rodando num número dedicado
- **`node:sqlite`** nativo (Node 22.5+) — sem build nativo
- **cron** para lembretes e relatórios
- **API da Claude** (multimodal) — resumo, intenção e visão

## Skills (roadmap)

| Fase | Skill | O que faz |
|------|-------|-----------|
| 0 | Setup | Encanamento: projeto roda e conecta no WhatsApp |
| 1 | 📝 Assistente | Salva/resume link, transcreve áudio, cria lembrete |
| 2 | 💰 Financeiro | "gastei 45 no mercado" → categoriza e guarda; relatório semanal |
| 3 | 🍽️ Calorias | Foto da refeição → estima prato e calorias |

## Rodar (Fase 0)

```bash
npm install
npm run dev
```

> ⚠️ O Baileys conecta lendo um QR code como se fosse o WhatsApp Web. Use um
> **número secundário/dedicado** para o Jarbas — nunca o seu número pessoal.
