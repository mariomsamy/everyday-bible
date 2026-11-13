# syntax=docker/dockerfile:1
# Bible PWA: builds the app, then runs the zero-dependency Node server that serves it. Works on any host with Docker.

FROM node:24-alpine AS build
WORKDIR /src/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
# Contact address printed in the privacy policy (build time).
ARG VITE_CONTACT_EMAIL=
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DB_PATH=/data/data.sqlite TEXTS_DIR=/data/texts
WORKDIR /srv
COPY package.json ./
COPY server ./server
COPY scripts ./scripts
COPY deploy/entrypoint.sh ./deploy/entrypoint.sh
COPY app/src/data/catalog.json ./app/src/data/catalog.json
COPY --from=build /src/app/dist ./app/dist
RUN mkdir -p /data/texts && chown -R node:node /data /srv && chmod +x deploy/entrypoint.sh
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./deploy/entrypoint.sh"]
CMD ["node", "server/index.mjs"]
