// O agendador de lembretes: um "verificador periódico".
//
// Por que NÃO usamos cron aqui? Cron é pra tarefas que se REPETEM num horário
// fixo ("todo dia às 8h"). Um lembrete é PONTUAL ("às 9h de amanhã, uma vez").
// Pra isso o padrão é: guardar a hora no banco + um loop que, de tempos em
// tempos, pergunta ao banco "algum lembrete venceu?". Bônus: como ele relê o
// banco a cada volta, os lembretes SOBREVIVEM a reiniciar o bot.

import { lembretesVencidos, marcarAvisado } from "./db.ts";

// De quanto em quanto tempo checamos. 30s dá precisão de ~meio minuto, que é de
// sobra pra lembretes do dia a dia, sem ficar martelando o banco.
const INTERVALO_MS = 30_000;

// Recebe a função de envio de fora (desacoplado do Baileys): o agendador não
// sabe que existe WhatsApp, só sabe "mandar um texto pra um destino".
type Enviar = (destino: string, texto: string) => Promise<void>;

export function iniciarAgendador(enviar: Enviar): void {
  setInterval(async () => {
    // Pega o que já venceu e ainda não foi avisado.
    const vencidos = lembretesVencidos(Date.now());
    for (const l of vencidos) {
      try {
        await enviar(l.destino, `⏰ Lembrete: ${l.texto}`);
        marcarAvisado(l.id); // só marca depois de enviar, pra não perder aviso
      } catch (erro) {
        // Um erro num lembrete não pode derrubar o loop nem os outros avisos.
        console.log(`⚠️ falhou ao avisar lembrete ${l.id}:`, erro);
      }
    }
  }, INTERVALO_MS);

  console.log("⏰ Agendador de lembretes de pé.");
}
