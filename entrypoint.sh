#!/bin/sh
# Entrypoint do Jarbas no Azure Container Apps (app SEMPRE-LIGADO).
#
# Dois problemas que este script resolve:
#   1. O disco do container é EFÊMERO (some a cada restart/deploy).
#   2. O SQLite NÃO funciona direto sobre Azure Files (SMB): ele depende de file
#      locking (fcntl) que o mount de rede não suporta.
#
# Solução (a "dança da cópia", igual garimpo, mas para um app que não termina):
#   - o cofre durável é o file share, montado em /share;
#   - o Jarbas trabalha na "bancada" local (/app/data e /app/auth) — rápida e com
#     locking, então o SQLite fica feliz;
#   - RESTAURA do cofre no boot, faz BACKUP de volta a cada 5 min (isso já é o
#     backup automático) e um último backup no shutdown.

SHARE="${SHARE_DIR:-/share}"        # onde o Azure File Share é montado
INTERVALO="${BACKUP_INTERVALO:-300}" # segundos entre backups (300 = 5 min)

mkdir -p "$SHARE/data" /app/data /app/auth

# ---- 1) RESTAURA do cofre (se já houver dados de execuções anteriores) ----
if [ -f "$SHARE/data/jarbas.db" ]; then
  cp "$SHARE/data/jarbas.db" /app/data/jarbas.db
  echo "🗃️  banco restaurado do share ($(wc -c < "$SHARE/data/jarbas.db") bytes)"
else
  echo "🗃️  primeiro boot — nenhum banco no share ainda"
fi
if [ -f "$SHARE/auth.tar" ]; then
  tar xf "$SHARE/auth.tar" -C /app/auth
  echo "📲 sessão do WhatsApp restaurada do share ($(ls /app/auth | wc -l) arquivos)"
else
  echo "📲 nenhuma sessão no share — vai precisar parear o QR"
fi

# ---- função que salva a bancada de volta no cofre ----
backup() {
  # .backup do SQLite = cópia consistente MESMO com o app escrevendo.
  if [ -f /app/data/jarbas.db ]; then
    sqlite3 /app/data/jarbas.db ".backup '$SHARE/data/jarbas.db'" 2>/dev/null \
      || echo "⚠️  backup do banco falhou (tenta de novo no próximo ciclo)"
  fi
  # auth/ tem MUITOS arquivos pequenos (lentos no SMB) → empacota num tar só.
  # Escreve num .tmp e renomeia (atômico): se cair no meio, o auth.tar antigo
  # continua intacto.
  if [ -n "$(ls -A /app/auth 2>/dev/null)" ]; then
    tar cf "$SHARE/auth.tar.tmp" -C /app/auth . 2>/dev/null \
      && mv "$SHARE/auth.tar.tmp" "$SHARE/auth.tar"
  fi
  echo "💾 backup no share ($(date '+%H:%M:%S'))"
}

# ---- 2) SOBE o Jarbas em segundo plano ----
# (sem --env-file: na nuvem os segredos vêm do ambiente do Container App)
node --import tsx src/index.ts &
APP=$!

# ---- 3) shutdown (SIGTERM do Container Apps): backup final e encerra ----
trap 'echo "🛑 encerrando…"; backup; kill "$APP" 2>/dev/null; exit 0' TERM INT

# ---- 4) enquanto o Jarbas vive, faz backup a cada $INTERVALO ----
while kill -0 "$APP" 2>/dev/null; do
  sleep "$INTERVALO"
  backup
done

# se o app caiu sozinho: um último backup e propaga o código de saída
wait "$APP"
CODE=$?
backup
exit "$CODE"
