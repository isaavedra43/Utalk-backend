# Usar imagen oficial de Node.js
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (evitar errores de lockfile en CI)
# Preferimos npm ci, pero caemos a npm install si detecta desincronización
RUN npm ci --omit=dev || npm install --omit=dev

# Copiar código fuente
COPY . .

# Crear directorio de uploads
RUN mkdir -p uploads

# Exponer puerto (usar 3001 que es el que usa la app)
EXPOSE 3001

# Usuario no root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Comando de inicio
CMD ["npm", "start"] 