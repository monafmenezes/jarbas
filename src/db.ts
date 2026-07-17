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
