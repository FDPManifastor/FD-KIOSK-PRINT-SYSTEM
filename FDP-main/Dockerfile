FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV UPLOADS_ROOT=/data/uploads

RUN mkdir -p /data/uploads/copy1 /data/uploads/copy2 /data/uploads/copy3 /data/uploads/copy4

EXPOSE 3000

CMD ["npm", "start"]