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
