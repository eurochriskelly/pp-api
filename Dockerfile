FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg62-turbo-dev \
  libgif-dev \
  librsvg2-dev && \
  rm -rf /var/lib/apt/lists/* && \
  npm ci
COPY . .
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN npm run build
ENV NODE_ENV=production \
    PP_PORT_API=7001 \
    PP_ENV=production \
    PP_API_APP=production/mobile
EXPOSE 7001
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 CMD curl -f http://localhost:7001/health || exit 1
CMD ["node", "dist/server.js"]
