FROM node:21-alpine3.17

RUN apk add --no-cache tini

ARG PORT
ENV PORT=${PORT:-80}

EXPOSE ${PORT}

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install
RUN npm run compile

# used to run node process as something other than PID 1
# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "dist/main.js"]
