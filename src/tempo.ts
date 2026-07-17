// ⏱️ Utilidades de tempo e fuso do Jarbas.
// Centraliza o fuso da Monalisa num lugar só (DRY): o cérebro (lembretes) e as
// consultas de gasto precisam dele. Antes o fuso vivia dentro do brain.ts —
// mas fuso não é assunto do "cérebro", é utilidade de tempo. Mora melhor aqui.

// Fuso da Monalisa (João Pessoa/PB): UTC-3. O Brasil não tem mais horário de
// verão, então o offset é fixo — dá pra carimbar "-03:00" com segurança.
export const FUSO = "America/Fortaleza";
export const OFFSET = "-03:00";

// Epoch (ms) da MEIA-NOITE de hoje NO FUSO DA MONALISA. Detalhe crucial: "hoje"
// começa à 00:00 LOCAL, não no fuso do servidor — a "armadilha do relógio" de
// novo. Por isso pegamos a data já no fuso dela e carimbamos o offset.
export function inicioDoDia(agora: Date = new Date()): number {
  // Formata a data no fuso dela. O locale "en-CA" dá o formato ISO AAAA-MM-DD,
  // que é exatamente o que precisamos pra remontar a meia-noite local.
  const dataLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return new Date(`${dataLocal}T00:00:00${OFFSET}`).getTime();
}
