FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Exponemos el puerto de Angular
EXPOSE 4200

# Exponemos el host para que sea accesible desde fuera del contenedor
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]