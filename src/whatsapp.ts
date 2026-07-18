// Conexão com o WhatsApp via Baileys.
// Etapa 2: abrir a conexão e mostrar o QR Code no terminal.
// Etapa 3: manter a sessão viva — reconectar sozinho quando a conexão cai.

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import type { Brain } from "./brain.ts";
import { rotearTexto } from "./roteador.ts";
import { estimarCaloriasDaFoto } from "./skills/estimar-calorias.ts";

// Lista de contatos que podem falar com o Jarbas (você + quem você liberar).
// Vem do .env: CONTATOS_AUTORIZADOS com os números (DDI+DDD, só dígitos),
// separados por vírgula. Guardamos só os dígitos pra comparação.
const AUTORIZADOS = new Set(
  (process.env.CONTATOS_AUTORIZADOS ?? "")
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter((n) => n.length > 0),
);

// Quem mandou está autorizado? O identificador pode chegar como telefone
// (5585...@s.whatsapp.net) ou como LID (137...@lid, anônimo por privacidade).
// Comparamos os dígitos da parte antes do @; se o WhatsApp entregar como LID,
// basta adicionar esse número anônimo ao .env também.
function ehAutorizado(jid?: string | null): boolean {
  if (!jid) return false;
  const id = jidNormalizedUser(jid).split("@")[0]?.replace(/\D/g, "") ?? "";
  return AUTORIZADOS.has(id);
}

// Referência viva do socket. Quando a conexão cai e reconecta, criamos um sock
// NOVO — então quem envia mensagens de fora do fluxo (o agendador) não pode
// guardar um sock fixo; consulta esta variável, que apontamos pro sock atual.
let sockAtual: ReturnType<typeof makeWASocket> | null = null;

// Envia uma mensagem já assinada com o 🤵. Usada pelo agendador de lembretes.
export async function enviar(destino: string, texto: string): Promise<void> {
  if (!sockAtual) {
    console.log("⚠️ sem conexão no momento — não deu pra enviar agora.");
    return;
  }
  await sockAtual.sendMessage(destino, { text: `🤵 ${texto}` });
}

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
  sockAtual = sock; // deixa esta conexão disponível pro agendador enviar lembretes

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

  // 6. Escuta mensagens recebidas — só reage a contatos da allowlist (você + quem
  //    você liberar no .env). Usando um número DEDICADO, as mensagens de vocês
  //    chegam com fromMe=false; o único fromMe=true é a resposta do próprio bot.
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // "notify" = mensagem nova de verdade (ignora sincronização de histórico etc.).
    if (type !== "notify") return;

    for (const msg of messages) {
      // Precisa ter conteúdo e NÃO ser a resposta do próprio Jarbas (fromMe).
      // Esse continue no fromMe é o anti-loop: barra tudo que o bot mesmo mandou.
      if (!msg.message || msg.key.fromMe) continue;

      // Só responde a quem está autorizado no .env.
      if (!ehAutorizado(msg.key.remoteJid)) {
        // Ajuda no primeiro setup: mostra o JID que chegou pra você colocar no
        // .env (útil pra saber se o contato vem como número ou como LID).
        console.log(`🚫 mensagem de contato não autorizado: ${msg.key.remoteJid}`);
        continue;
      }

      // FOTO: caminho próprio, à parte do texto. Uma foto de refeição tem
      // intenção óbvia (estimar calorias), então vai DIRETO pra skill — sem
      // passar pelo roteador de intenção (mesma economia do atalho "tomei", que
      // não gasta uma chamada de IA pra classificar o que já é claro).
      if (msg.message.imageMessage) {
        try {
          // Mesmo downloadMediaMessage do áudio: ele baixa qualquer mídia.
          const bytes = await downloadMediaMessage(msg, "buffer", {});
          // A legenda mandada junto da foto vira dica pro modelo (prato regional).
          const legenda = msg.message.imageMessage.caption ?? undefined;
          console.log(
            `📷 foto recebida${legenda ? ` (legenda: "${legenda}")` : ""} → estimando calorias...`,
          );
          const resposta = await estimarCaloriasDaFoto(
            bytes,
            brain,
            msg.key.remoteJid!,
            legenda,
          );
          await sock.sendMessage(msg.key.remoteJid!, { text: `🤵 ${resposta}` });
        } catch (erro) {
          // Foto expirada, rede caiu... avisa em vez de derrubar o bot.
          await sock.sendMessage(msg.key.remoteJid!, {
            text: `🤵 🍽️ não consegui analisar a foto: ${(erro as Error).message}`,
          });
        }
        continue; // já respondeu (ou avisou do erro): não segue pro fluxo de texto.
      }

      // O "texto" pode vir de dois lugares: digitado, ou falado num áudio.
      let texto: string | undefined;

      if (msg.message.audioMessage) {
        // É um áudio: baixa os bytes crus e manda pro Whisper transcrever.
        try {
          const bytes = await downloadMediaMessage(msg, "buffer", {});
          texto = await brain.transcrever(bytes);
        } catch (erro) {
          // Áudio expirado, rede caiu... avisa em vez de derrubar o bot.
          await sock.sendMessage(msg.key.remoteJid!, {
            text: `🤵 🎤 não consegui transcrever: ${(erro as Error).message}`,
          });
          continue;
        }
      } else {
        // Texto digitado (cobre os dois formatos mais comuns de mensagem).
        texto =
          msg.message.conversation ??
          msg.message.extendedTextMessage?.text ??
          undefined;
      }

      if (!texto) continue;

      // 1. Entrega o texto ao roteador: ele classifica a intenção e despacha
      //    pra skill certa, devolvendo a resposta pronta.
      const resposta = await rotearTexto(texto, brain, msg.key.remoteJid!);

      // 2. Responde na mesma conversa de onde veio, com o prefixo do robô.
      await sock.sendMessage(msg.key.remoteJid!, { text: `🤵 ${resposta}` });
    }
  });

  return sock;
}
