FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

COPY server/package.json ./package.json
RUN npm install --omit=dev

COPY server/server.js ./server.js
RUN mkdir -p /app/public /data

COPY index.html app.css app.js db.js manifest.webmanifest sw.js location-builder.css location-builder.js ui-fixes.js /app/public/
COPY icons /app/public/icons

EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "server.js"]
