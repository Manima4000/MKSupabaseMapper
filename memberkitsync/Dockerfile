FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm install --save-dev tsx typescript @types/node

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
