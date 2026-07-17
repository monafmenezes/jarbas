// Conexão com o WhatsApp via Baileys.
// Etapa 2: abrir a conexão e mostrar o QR Code no terminal.
// Etapa 3: manter a sessão viva — reconectar sozinho quando a conexão cai.

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";

export async function conectarWhatsApp() {
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
        conectarWhatsApp();
      }
    }
  });

  return sock;
}
