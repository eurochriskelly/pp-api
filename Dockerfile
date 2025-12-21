FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN apk add --no-cache curl
RUN npm run build
ENV NODE_ENV=production \
    PP_PORT_API=7001 \
    PP_DATABASE=MockTourno \
    PP_ENV=production \
    PP_API_APP=production/mobile
EXPOSE 7001
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=5 CMD curl -f http://localhost:7001/health || exit 1
CMD ["node", "dist/server.js"]
