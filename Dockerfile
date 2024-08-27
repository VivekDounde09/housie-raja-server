# base image
FROM node:20 AS base

WORKDIR /housieraja

ARG PORT

RUN npm install pm2 --location=global

COPY package.json .
COPY package-lock.json .
COPY prisma/schema.prisma prisma/schema.prisma

ENV HUSKY=0

RUN npm install

COPY . .

EXPOSE ${PORT}

# development image
FROM base AS housieraja-dev

CMD ["npm", "run", "start:dev"]

# production image
FROM base AS housieraja

RUN npm run build

CMD ["pm2-runtime", "dist/main.js", "--name", "housieraja", "--wait-ready", "--listen-timeout 60000", "--kill-timeout", "60000"]
