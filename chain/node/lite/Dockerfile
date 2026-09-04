FROM node:22-alpine

WORKDIR /app
COPY server.mjs /app/server.mjs

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 18100
CMD ["node", "/app/server.mjs"]
