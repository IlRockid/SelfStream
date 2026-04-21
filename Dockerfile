FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

RUN git clone https://github.com/TUO_USERNAME_GITHUB/SelfStream .

RUN npm install

ENV PORT=7860
EXPOSE 7860

RUN npm run build

CMD ["npm", "start"]
