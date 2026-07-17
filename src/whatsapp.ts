// Conexão com o WhatsApp via Baileys.
// Etapa 2: abrir a conexão e mostrar o QR Code no terminal.
// Etapa 3: manter a sessão viva — reconectar sozinho quando a conexão cai.

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import type { Brain } from "./brain.ts";

// Recebe o "cérebro" de fora (injeção de dependência): a conexão não sabe se é
// OpenAI ou Claude, só conhece o contrato Brain. Trocar de provedor não toca aqui.
export async function conectarWhatsApp(brain: Brain) {
  // 1. Estado de autenticação (credenciais da sessão) guardado na pasta ./auth.
  //    Na primeira vez a pasta vem vazia, então o WhatsApp vai pedir o QR Code.
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  // 2. Descobrimos a versão atual do WhatsApp Web. Se o bot se anunciar com uma
  //    versão velha, o WhatsApp recusa o pareamento ("verifique sua conexão").
  const { version } = await fetchLatestBaileysVersion();
  console.log(`🔢 Usando WhatsApp Web v${version.join(".")}`);

  // 3. Cria o socket: a "linha sempre aberta" (WebSocket) com o WhatsApp.
  //    Passamos o logger no modo silencioso pra não poluir o terminal.
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // 4. Sempre que as credenciais mudarem, salva de volta na pasta ./auth.
  sock.ev.on("creds.update", saveCreds);

  // 5. O Baileys nos avisa sobre a conexão por eventos. Aqui reagimos a eles.
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Quando há um QR novo pra escanear, desenhamos ele no terminal.
    if (qr) {
      console.log("\n📲 Escaneie o QR Code abaixo no seu WhatsApp:");
      console.log("   WhatsApp > Aparelhos conectados > Conectar um aparelho\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Jarbas conectado ao WhatsApp!");
    }

    if (connection === "close") {
      // Descobrimos POR QUE a conexão caiu, lendo o código do erro.
      const codigo = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const deslogado = codigo === DisconnectReason.loggedOut;

      if (deslogado) {
        // Logout de verdade: a sessão morreu. Precisa apagar auth/ e reescanear.
        console.log(
          "❌ Sessão encerrada (logout). Apague a pasta auth/ e rode de novo pra escanear.",
        );
      } else {
        // Qualquer outra queda (inclusive o 515 logo após o 1º pareamento):
        // o certo é reabrir a conexão.
        console.log("🔄 Conexão caiu, reconectando...");
        conectarWhatsApp(brain);
      }
    }
  });

  // 6. Escuta mensagens recebidas — mas só reage ao SEU self-chat (você -> você).
  //    É a decisão de segurança do projeto: usando o número pessoal, o bot ignora
  //    conversas com terceiros e só obedece você mesma.
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // "notify" = mensagem nova de verdade (ignora sincronização de histórico etc.).
    if (type !== "notify") return;

    // Você tem DUAS identidades: o número normal e o LID (identificador que o
    // WhatsApp usa por privacidade). O self-chat pode chegar por qualquer uma,
    // então reconhecemos as duas como "você".
    const meuJid = jidNormalizedUser(sock.user!.id);
    const meuLid = sock.user!.lid ? jidNormalizedUser(sock.user!.lid) : undefined;
    const souEu = (jid?: string | null) =>
      jid === meuJid || (meuLid !== undefined && jid === meuLid);

    for (const msg of messages) {
      // Precisa ter conteúdo, ter sido enviada por você (fromMe)...
      if (!msg.message || !msg.key.fromMe) continue;
      // ...e ser da conversa "Você" (remetente = você mesma).
      if (!souEu(msg.key.remoteJid)) continue;

      // Pega o texto (cobre os dois formatos mais comuns de mensagem de texto).
      const texto =
        msg.message.conversation ?? msg.message.extendedTextMessage?.text;
      if (!texto) continue;

      // ⚠️ Evita loop infinito: a resposta do bot também é "fromMe" e cairia
      // aqui de novo. Marcamos toda resposta com o prefixo 🤵 e ignoramos ele.
      if (texto.startsWith("🤵")) continue;

      // 1. Pergunta ao cérebro O QUE a pessoa quer.
      const intencao = await brain.classificarIntencao(texto);
      console.log(`💬 "${texto}" → intenção: ${intencao}`);

      // 2. Roteia pra skill certa. Cada destino monta a resposta.
      let resposta: string;
      switch (intencao) {
        case "conversa":
          // Papo livre já funciona de verdade (o "ChatGPT no zap").
          resposta = await brain.conversar(texto);
          break;
        case "resumir_link":
          resposta = "🔗 (em breve) vou baixar e resumir esse link pra você.";
          break;
        case "criar_lembrete":
          resposta = "⏰ (em breve) vou guardar esse lembrete e te avisar na hora.";
          break;
      }

      // 3. Responde na mesma conversa de onde veio, com o prefixo do robô.
      await sock.sendMessage(msg.key.remoteJid!, { text: `🤵 ${resposta}` });
    }
  });

  return sock;
}
