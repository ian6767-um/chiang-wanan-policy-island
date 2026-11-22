# 深淵獵團 遊戲伺服器（Render / Railway / Fly.io 都可用）
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY server ./server
COPY public ./public
ENV PORT=3000 ABYSS_DATA=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
