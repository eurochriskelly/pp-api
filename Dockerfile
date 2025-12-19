FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production \
    PP_PORT_API=7001 \
    PP_DATABASE=MockTourno \
    PP_ENV=production \
    PP_API_APP=production/mobile
EXPOSE 7001
CMD ["node", "dist/server.js"]
