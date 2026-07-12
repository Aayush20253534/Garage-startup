FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client sqlite

COPY package*.json ./
COPY prisma ./prisma

# package.json postinstall generates Prisma Client from the checked-in schema.
RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "start"]