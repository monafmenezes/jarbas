# Node 24 — precisamos de Node >= 22.5 pro SQLite nativo (node:sqlite).
FROM node:24-bookworm-slim

WORKDIR /app

# sqlite3 (CLI) — o entrypoint usa o comando ".backup" dele pra fazer uma cópia
# CONSISTENTE do banco mesmo com o Jarbas escrevendo (um "cp" cru poderia pegar
# o arquivo no meio de uma escrita e salvar um backup corrompido).
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Dependências primeiro, sozinhas: enquanto o package*.json não mudar, o Docker
# reaproveita esta camada em cache e NÃO reinstala tudo a cada build de código.
COPY package*.json ./
RUN npm install

# Agora o resto do código (o .dockerignore tira .env, auth/, data/, node_modules…).
COPY . .

# Pastas que o Jarbas usa em runtime. Ficam vazias na imagem — o entrypoint
# (etapa 2) vai preenchê-las a partir do file share antes de subir o bot.
RUN mkdir -p /app/data /app/auth

ENV NODE_ENV=production

# O entrypoint restaura auth/ + banco do file share e então sobe o Jarbas.
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
