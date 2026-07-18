  // Banco de dados do Jarbas usando node:sqlite — o SQLite embutido no Node 24.
// É um banco SQL de verdade guardado num arquivo só (data/jarbas.db), sem
// instalar servidor nem compilar biblioteca nativa. Por isso o escolhemos.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";

// Como um lembrete fica guardado. `quando` é epoch em milissegundos (UTC),
// que é fuso-agnóstico: um instante no tempo, sem ambiguidade de timezone.
export interface Lembrete {
  id: number;
  texto: string;
  quando: number;
  destino: string; // JID da conversa pra onde mandar o aviso
  avisado: number; // 0 = ainda não avisei / 1 = já avisei
}

// Como um gasto fica guardado. Detalhe importante: `centavos` é INTEGER, não
// um valor "quebrado" (float). Dinheiro em ponto flutuante gera erro de
// arredondamento (0.1 + 0.2 != 0.3), então guardamos tudo em centavos e só
// dividimos por 100 na hora de mostrar. R$ 45,90 vira 4590.
export interface Gasto {
  id: number;
  centavos: number;
  categoria: string; // "mercado", "transporte", "lazer"... o cérebro decide
  descricao: string; // o texto original: "mercado", "uber pro trabalho"
  quando: number; // epoch em ms (UTC), igual aos lembretes
  destino: string; // JID da conversa de onde veio (pra mandar o relatório)
}

// Como uma refeição estimada por foto fica guardada. `calorias` é INTEGER (kcal)
// e é uma ESTIMATIVA do cérebro pela imagem. Guardamos o `prato` (o que o modelo
// viu) pra poder listar no resumo do dia. Mesma ideia do gasto: cada registro
// carrega o `destino` pro relatório diário achar depois.
export interface Refeicao {
  id: number;
  prato: string; // "bolo de rolo", "arroz, feijão e frango grelhado"
  calorias: number; // kcal estimadas (inteiro)
  quando: number; // epoch em ms (UTC), igual aos gastos
  destino: string; // JID da conversa de onde veio a foto
}

// Nos testes usamos ":memory:" (banco que só vive na RAM) pra não sujar o disco.
const CAMINHO = process.env.JARBAS_DB ?? "data/jarbas.db";
if (CAMINHO !== ":memory:") mkdirSync("data", { recursive: true });

const db = new DatabaseSync(CAMINHO);

// Cria a tabela na primeira vez. "IF NOT EXISTS" torna isso seguro de rodar sempre.
db.exec(`
  CREATE TABLE IF NOT EXISTS lembretes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    texto   TEXT    NOT NULL,
    quando  INTEGER NOT NULL,
    destino TEXT    NOT NULL,
    avisado INTEGER NOT NULL DEFAULT 0
  )
`);

// Tabela dos gastos. Mesma ideia: roda sempre, mas só cria se ainda não existir.
db.exec(`
  CREATE TABLE IF NOT EXISTS gastos (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    centavos  INTEGER NOT NULL,
    categoria TEXT    NOT NULL,
    descricao TEXT    NOT NULL,
    quando    INTEGER NOT NULL,
    destino   TEXT    NOT NULL
  )
`);

// Tabela das refeições estimadas por foto. Estrutura enxuta, no espírito do
// gasto: o que foi consumido (prato) + quanto (calorias) + quando + de qual
// conversa. É o que o resumo diário vai somar no fim do dia.
db.exec(`
  CREATE TABLE IF NOT EXISTS refeicoes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    prato    TEXT    NOT NULL,
    calorias INTEGER NOT NULL,
    quando   INTEGER NOT NULL,
    destino  TEXT    NOT NULL
  )
`);

// Remédios cadastrados: o "quê" e o "que horas" de cada um. `hora` é local no
// formato "HH:MM" (ex.: "22:00"); `ativo` permite "desligar" um remédio sem
// apagar o histórico. Um remédio 2x/dia é cadastrado duas vezes (um por horário).
db.exec(`
  CREATE TABLE IF NOT EXISTS remedios (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nome    TEXT    NOT NULL,
    hora    TEXT    NOT NULL,
    destino TEXT    NOT NULL,
    ativo   INTEGER NOT NULL DEFAULT 1
  )
`);

// Doses do dia a dia: UMA linha por remédio por dia em que ele foi disparado.
// É a "memória do dia" — responde "já tomei hoje?". `status` = pendente | tomado
// | perdido. `avisos` conta quantas vezes já cutuquei (pra limitar a insistência);
// `proximo_aviso` (epoch ms) é quando devo cutucar de novo.
db.exec(`
  CREATE TABLE IF NOT EXISTS doses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    remedio_id    INTEGER NOT NULL,
    destino       TEXT    NOT NULL,
    dia           TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'pendente',
    avisos        INTEGER NOT NULL DEFAULT 0,
    proximo_aviso INTEGER NOT NULL DEFAULT 0
  )
`);

// Guarda um novo lembrete e devolve o id gerado.
// Os "?" são placeholders: o valor entra separado do SQL, o que evita injeção.
export function salvarLembrete(
  texto: string,
  quando: number,
  destino: string,
): number {
  const r = db
    .prepare("INSERT INTO lembretes (texto, quando, destino) VALUES (?, ?, ?)")
    .run(texto, quando, destino);
  return Number(r.lastInsertRowid);
}

// Lembretes que já chegaram a hora (quando <= agora) e que ainda não avisei.
export function lembretesVencidos(agora: number): Lembrete[] {
  const linhas = db
    .prepare(
      "SELECT id, texto, quando, destino, avisado FROM lembretes WHERE avisado = 0 AND quando <= ? ORDER BY quando",
    )
    .all(agora);
  return linhas as unknown as Lembrete[];
}

// Marca um lembrete como já avisado, pra não disparar de novo.
export function marcarAvisado(id: number): void {
  db.prepare("UPDATE lembretes SET avisado = 1 WHERE id = ?").run(id);
}

// Guarda um novo gasto e devolve o id gerado. `quando` é opcional: por padrão
// é agora (o instante em que a mensagem chegou), mas deixamos passar por fora
// pra facilitar os testes (simular um gasto de terça-feira, por exemplo).
export function salvarGasto(
  centavos: number,
  categoria: string,
  descricao: string,
  destino: string,
  quando: number = Date.now(),
): number {
  const r = db
    .prepare(
      "INSERT INTO gastos (centavos, categoria, descricao, quando, destino) VALUES (?, ?, ?, ?, ?)",
    )
    .run(centavos, categoria, descricao, quando, destino);
  return Number(r.lastInsertRowid);
}

// Uma linha do resumo: quanto foi gasto numa categoria (em centavos).
export interface ResumoCategoria {
  categoria: string;
  total: number; // soma em centavos
}

// Quais conversas (destinos) tiveram algum gasto desde `desde` (epoch ms).
// O relatório manda um resumo pra cada uma — hoje é só a self-chat, mas assim
// já funciona se um dia o Jarbas atender mais de uma conversa.
export function destinosComGastos(desde: number): string[] {
  const linhas = db
    .prepare("SELECT DISTINCT destino FROM gastos WHERE quando >= ?")
    .all(desde) as { destino: string }[];
  return linhas.map((l) => l.destino);
}

// Soma os gastos de UMA conversa por categoria, da maior pra menor. É o SQL
// fazendo a conta pesada (SUM + GROUP BY) em vez de puxar tudo e somar no JS.
export function gastosPorCategoria(
  destino: string,
  desde: number,
): ResumoCategoria[] {
  const linhas = db
    .prepare(
      "SELECT categoria, SUM(centavos) AS total FROM gastos " +
        "WHERE destino = ? AND quando >= ? GROUP BY categoria ORDER BY total DESC",
    )
    .all(destino, desde);
  return linhas as unknown as ResumoCategoria[];
}

// ─── Calorias ────────────────────────────────────────────────────────────────

// Guarda uma refeição estimada e devolve o id gerado. Como no gasto, `quando` é
// opcional (padrão = agora) — deixamos passar por fora pra facilitar os testes
// (simular uma refeição de ontem, por exemplo).
export function salvarRefeicao(
  prato: string,
  calorias: number,
  destino: string,
  quando: number = Date.now(),
): number {
  const r = db
    .prepare(
      "INSERT INTO refeicoes (prato, calorias, quando, destino) VALUES (?, ?, ?, ?)",
    )
    .run(prato, calorias, quando, destino);
  return Number(r.lastInsertRowid);
}

// ─── Medicação ───────────────────────────────────────────────────────────────

// Um remédio cadastrado.
export interface Remedio {
  id: number;
  nome: string;
  hora: string; // "HH:MM" local, ex.: "22:00"
  destino: string; // JID da conversa pra onde avisar
  ativo: number; // 1 = ligado / 0 = desligado
}

// O estado de uma dose no dia: esperando, confirmada, ou perdida (deu 1h e nada).
export type StatusDose = "pendente" | "tomado" | "perdido";

// Uma dose de um dia específico.
export interface Dose {
  id: number;
  remedio_id: number;
  destino: string;
  dia: string; // "YYYY-MM-DD" local
  status: StatusDose;
  avisos: number; // quantos avisos já mandei desta dose
  proximo_aviso: number; // epoch ms de quando cutucar de novo
}

// Cadastra um remédio e devolve o id gerado.
export function salvarRemedio(
  nome: string,
  hora: string,
  destino: string,
): number {
  const r = db
    .prepare("INSERT INTO remedios (nome, hora, destino) VALUES (?, ?, ?)")
    .run(nome, hora, destino);
  return Number(r.lastInsertRowid);
}

// Todos os remédios ligados. O verificador varre esta lista pra saber o que
// disparar e a que horas.
export function remediosAtivos(): Remedio[] {
  const linhas = db
    .prepare("SELECT id, nome, hora, destino, ativo FROM remedios WHERE ativo = 1")
    .all();
  return linhas as unknown as Remedio[];
}

// Os remédios ligados de UMA conversa, ordenados por horário — é a lista que a
// pessoa vê quando pergunta "quais remédios eu tomo?".
export function remediosAtivosDe(destino: string): Remedio[] {
  const linhas = db
    .prepare(
      "SELECT id, nome, hora, destino, ativo FROM remedios " +
        "WHERE ativo = 1 AND destino = ? ORDER BY hora",
    )
    .all(destino);
  return linhas as unknown as Remedio[];
}

// Já existe um remédio ativo IGUAL (mesmo nome e mesma hora) nesta conversa? Usado
// no cadastro pra não criar duplicata (que viraria aviso em dobro no mesmo horário).
// Mesmo nome em horário DIFERENTE é permitido (ex.: um remédio 2x/dia).
export function jaCadastrado(
  nome: string,
  hora: string,
  destino: string,
): boolean {
  const linha = db
    .prepare(
      "SELECT 1 FROM remedios WHERE ativo = 1 AND destino = ? " +
        "AND lower(nome) = lower(?) AND hora = ? LIMIT 1",
    )
    .get(destino, nome, hora);
  return linha !== undefined;
}

// Cria a dose (pendente) de um remédio num dia. Devolve o id gerado.
export function criarDose(
  remedioId: number,
  destino: string,
  dia: string,
): number {
  const r = db
    .prepare("INSERT INTO doses (remedio_id, destino, dia) VALUES (?, ?, ?)")
    .run(remedioId, destino, dia);
  return Number(r.lastInsertRowid);
}

// A dose de um remédio num dia, se já existir. Serve pra NÃO criar a mesma dose
// duas vezes (o verificador roda a cada minuto; a dose do dia é única).
export function doseDoDia(remedioId: number, dia: string): Dose | undefined {
  const linha = db
    .prepare(
      "SELECT id, remedio_id, destino, dia, status, avisos, proximo_aviso " +
        "FROM doses WHERE remedio_id = ? AND dia = ?",
    )
    .get(remedioId, dia);
  return linha as Dose | undefined;
}

// Muda o status de uma dose (ex.: 'tomado' quando ela confirma, 'perdido' se
// passou 1h sem confirmar).
export function marcarDose(id: number, status: StatusDose): void {
  db.prepare("UPDATE doses SET status = ? WHERE id = ?").run(status, id);
}

// Registra que mandei mais um aviso desta dose: soma 1 no contador e agenda o
// próximo aviso (epoch ms). O contador é o que limita a insistência (paro após N).
export function registrarAviso(doseId: number, proximoAviso: number): void {
  db.prepare(
    "UPDATE doses SET avisos = avisos + 1, proximo_aviso = ? WHERE id = ?",
  ).run(proximoAviso, doseId);
}

// Doses ainda PENDENTES cujo próximo aviso já venceu (proximo_aviso <= agora) —
// são as que o verificador precisa cutucar de novo (ou desistir, se já insistiu
// demais). Só pendentes: uma dose 'tomado'/'perdido' não recebe mais aviso.
export function dosesParaAvisar(agora: number): Dose[] {
  const linhas = db
    .prepare(
      "SELECT id, remedio_id, destino, dia, status, avisos, proximo_aviso " +
        "FROM doses WHERE status = 'pendente' AND proximo_aviso <= ?",
    )
    .all(agora);
  return linhas as unknown as Dose[];
}

// Um remédio pelo id — o verificador usa pra saber o NOME na hora de reavisar.
export function remedioPorId(id: number): Remedio | undefined {
  const linha = db
    .prepare("SELECT id, nome, hora, destino, ativo FROM remedios WHERE id = ?")
    .get(id);
  return linha as Remedio | undefined;
}

// Doses ainda pendentes de HOJE numa conversa — são as que a confirmação
// ("tomei") marca como tomadas de uma vez.
export function dosesPendentesDe(destino: string, dia: string): Dose[] {
  const linhas = db
    .prepare(
      "SELECT id, remedio_id, destino, dia, status, avisos, proximo_aviso " +
        "FROM doses WHERE status = 'pendente' AND destino = ? AND dia = ?",
    )
    .all(destino, dia);
  return linhas as unknown as Dose[];
}

// "Apaga" um remédio: na verdade DESLIGA (ativo = 0) — para de avisar e some da
// lista, mas o histórico de doses fica preservado (soft delete). Usado quando o
// tratamento acaba (ex.: um antibiótico de 15 dias).
export function desativarRemedio(id: number): void {
  db.prepare("UPDATE remedios SET ativo = 0 WHERE id = ?").run(id);
}

// Procura um remédio ativo pelo nome (sem diferenciar maiúsculas) numa conversa
// — é como a gente vai achar QUAL remédio desligar quando ela disser "apaga a
// vitamina D". Devolve o primeiro que casar, ou undefined.
export function remedioAtivoPorNome(
  nome: string,
  destino: string,
): Remedio | undefined {
  const linha = db
    .prepare(
      "SELECT id, nome, hora, destino, ativo FROM remedios " +
        "WHERE ativo = 1 AND destino = ? AND lower(nome) = lower(?)",
    )
    .get(destino, nome);
  return linha as Remedio | undefined;
}
