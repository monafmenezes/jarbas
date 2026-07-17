// Jarbas 🤵 — ponto de entrada.
// Etapa 2: abrir a conexão com o WhatsApp (QR Code no terminal).

import { conectarWhatsApp } from "./whatsapp.ts";

console.log("🤵 Jarbas acordando...");

await conectarWhatsApp();
