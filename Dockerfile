FROM node:25

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm i

# Copy source files
COPY index.ts .

# Persistent storage for XMTP database files
VOLUME ["/data"]

ENV XMTP_DB_PATH=/data

ENTRYPOINT ["npx", "tsx", "index.ts"]