// 💊 O coração da medicação: o verificador que dispara os avisos e INSISTE.
// Roda de tempos em tempos (chamado pelo agendador). Faz duas coisas:
//   1. Dispara a dose de um remédio quando chega o horário dele (1º aviso).
//   2. Reavisa as doses pendentes a cada 15 min, até 1h — depois desiste.
// `enviar` e `agora` vêm de fora (injeção) pra dar pra testar sem WhatsApp nem
// esperar o relógio: o teste passa um `enviar` falso e um `agora` fixo.

import {
  remediosAtivos,
  doseDoDia,
  criarDose,
  dosesParaAvisar,
  registrarAviso,
  marcarDose,
  remedioPorId,
} from "../db.ts";
import { diaLocal, horaLocal } from "../tempo.ts";

type Enviar = (destino: string, texto: string) => Promise<void>;

// De quanto em quanto tempo insistir, e quantas vezes no total.
const INSISTIR_MS = 15 * 60 * 1000; // 15 min
const MAX_AVISOS = 4; // 4 avisos (0, +15, +30, +45) → desiste em ~1h

export async function verificarRemedios(
  enviar: Enviar,
  agora: Date = new Date(),
): Promise<void> {
  const dia = diaLocal(agora);
  const hora = horaLocal(agora);
  const ts = agora.getTime();

  // 1. DISPARAR: pra cada remédio cujo horário já chegou e que ainda não tem
  //    dose hoje, cria a dose e manda o 1º aviso. (Comparação de "HH:MM" como
  //    string funciona por causa do zero à esquerda.)
  for (const r of remediosAtivos()) {
    if (hora >= r.hora && !doseDoDia(r.id, dia)) {
      const doseId = criarDose(r.id, r.destino, dia);
      await enviar(r.destino, `💊 hora do ${r.nome}! Quando tomar, responde "tomei".`);
      registrarAviso(doseId, ts + INSISTIR_MS); // conta o 1º aviso e agenda o 2º
    }
  }

  // 2. INSISTIR: pra cada dose pendente cujo aviso venceu, ou reavisa ou desiste.
  for (const dose of dosesParaAvisar(ts)) {
    if (dose.avisos >= MAX_AVISOS) {
      marcarDose(dose.id, "perdido"); // já insisti 1h e nada: registra e para
      continue;
    }
    const nome = remedioPorId(dose.remedio_id)?.nome ?? "seu remédio";
    await enviar(dose.destino, `💊 ainda não confirmou o ${nome}. Já tomou? responde "tomei".`);
    registrarAviso(dose.id, ts + INSISTIR_MS);
  }
}
