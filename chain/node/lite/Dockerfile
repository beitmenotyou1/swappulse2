FROM node:22-alpine

WORKDIR /app
COPY server.mjs peer-url.mjs /app/

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 18100
CMD ["node", "/app/server.mjs"]
