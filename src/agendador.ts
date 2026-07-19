// O agendador de lembretes: um "verificador periódico".
//
// Por que NÃO usamos cron aqui? Cron é pra tarefas que se REPETEM num horário
// fixo ("todo dia às 8h"). Um lembrete é PONTUAL ("às 9h de amanhã, uma vez").
// Pra isso o padrão é: guardar a hora no banco + um loop que, de tempos em
// tempos, pergunta ao banco "algum lembrete venceu?". Bônus: como ele relê o
// banco a cada volta, os lembretes SOBREVIVEM a reiniciar o bot.

import { Cron } from "croner";
import {
  lembretesVencidos,
  marcarAvisado,
  destinosComGastos,
  destinosComRefeicoes,
} from "./db.ts";
import { relatorioSemanal } from "./skills/relatorio-financeiro.ts";
import { resumoDiario } from "./skills/resumo-calorias.ts";
import { inicioDoDia } from "./tempo.ts";
import { verificarRemedios } from "./skills/verificar-remedios.ts";

// De quanto em quanto tempo checamos. 30s dá precisão de ~meio minuto, que é de
// sobra pra lembretes do dia a dia, sem ficar martelando o banco.
const INTERVALO_MS = 30_000;

// Uma semana em ms — a janela do relatório ("gastos dos últimos 7 dias").
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

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

    // No mesmo pulso, checa os remédios: dispara os do horário e insiste nos
    // pendentes. A skill cuida de tudo; um erro dela não pode derrubar o loop.
    try {
      await verificarRemedios(enviar);
    } catch (erro) {
      console.log("⚠️ falhou ao verificar remédios:", erro);
    }
  }, INTERVALO_MS);

  console.log("⏰ Agendador de lembretes e remédios de pé.");

  // Relatório financeiro semanal. AGORA sim é cron: uma tarefa que se REPETE
  // num horário fixo (todo domingo às 20h) — o oposto do lembrete pontual.
  // A expressão "0 20 * * 0" são 5 campos: minuto hora dia-do-mês mês dia-da-semana.
  //   0    → minuto 0
  //   20   → 20h (8 da noite)
  //   * *  → qualquer dia do mês, qualquer mês
  //   0    → domingo (0=dom, 1=seg, ... 6=sáb)
  // timeZone garante que "20h" é no fuso da Monalisa, não no do servidor.
  new Cron("0 20 * * 0", { timezone: "America/Fortaleza" }, async () => {
    const desde = Date.now() - UMA_SEMANA_MS;
    // Um resumo por conversa que teve gastos (hoje só a self-chat dela).
    for (const destino of destinosComGastos(desde)) {
      const texto = relatorioSemanal(destino, desde);
      if (!texto) continue; // sem gastos nessa conversa: nada a enviar
      try {
        await enviar(destino, texto);
      } catch (erro) {
        console.log(`⚠️ falhou ao mandar o relatório pra ${destino}:`, erro);
      }
    }
  });

  console.log("📊 Relatório financeiro semanal agendado (domingos, 20h).");

  // Resumo diário de calorias. Também é cron (repete num horário fixo), mas
  // DIÁRIO em vez de semanal: "0 21 * * *" = todo dia às 21h. A janela do resumo
  // é "desde a meia-noite de hoje" (inicioDoDia) — o dia civil, não "últimas 24h".
  //   0    → minuto 0
  //   21   → 21h (9 da noite), tarde o bastante pra já ter pego o jantar
  //   * * * → todo dia do mês, todo mês, todo dia da semana
  new Cron("0 21 * * *", { timezone: "America/Fortaleza" }, async () => {
    // Só as conversas que registraram refeição HOJE recebem o fechamento.
    for (const destino of destinosComRefeicoes(inicioDoDia())) {
      const texto = resumoDiario(destino);
      if (!texto) continue; // sem refeição hoje: nada a enviar (resumoDiario deu null)
      try {
        await enviar(destino, texto);
      } catch (erro) {
        console.log(`⚠️ falhou ao mandar o resumo de calorias pra ${destino}:`, erro);
      }
    }
  });

  console.log("🔥 Resumo diário de calorias agendado (todo dia, 21h).");
}
