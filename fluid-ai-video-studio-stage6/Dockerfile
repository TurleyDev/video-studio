FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js index.html editor.html ./
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node","server.js"]
