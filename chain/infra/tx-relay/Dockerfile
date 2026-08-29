FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev
COPY server.mjs /app/server.mjs
USER node
EXPOSE 8081
CMD ["node", "/app/server.mjs"]
