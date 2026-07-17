// ⏱️ Utilidades de tempo e fuso do Jarbas.
// Centraliza o fuso da Monalisa num lugar só (DRY): o cérebro (lembretes) e as
// consultas de gasto precisam dele. Antes o fuso vivia dentro do brain.ts —
// mas fuso não é assunto do "cérebro", é utilidade de tempo. Mora melhor aqui.

// Fuso da Monalisa (João Pessoa/PB): UTC-3. O Brasil não tem mais horário de
// verão, então o offset é fixo — dá pra carimbar "-03:00" com segurança.
export const FUSO = "America/Fortaleza";
export const OFFSET = "-03:00";

// O DIA de hoje no fuso da Monalisa, no formato ISO "AAAA-MM-DD". É a chave que
// identifica a dose do dia. O locale "en-CA" já entrega nesse formato.
export function diaLocal(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// A HORA de agora no fuso da Monalisa, no formato 24h "HH:MM" (ex.: "22:05").
// Mesmo formato dos remédios — assim dá pra comparar direto ("já passou das 22h?").
export function horaLocal(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);
}

// Epoch (ms) da MEIA-NOITE de hoje NO FUSO DA MONALISA. Detalhe crucial: "hoje"
// começa à 00:00 LOCAL, não no fuso do servidor — a "armadilha do relógio" de
// novo. Por isso pegamos a data já no fuso dela e carimbamos o offset.
export function inicioDoDia(agora: Date = new Date()): number {
  return new Date(`${diaLocal(agora)}T00:00:00${OFFSET}`).getTime();
}
