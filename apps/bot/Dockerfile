FROM node:20-alpine

WORKDIR /app

COPY apps/bot/package.json ./
RUN npm install --production

COPY apps/bot/src/ ./src/

EXPOSE 3000

CMD ["node", "src/index.js"]
