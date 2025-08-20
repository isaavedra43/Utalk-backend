# Usar imagen oficial de Node.js (actualizada a versión 20)
FROM node:20-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production --no-audit --no-fund

# Copiar código fuente (excluir archivos innecesarios)
COPY . .
RUN rm -rf node_modules/.cache && \
    rm -rf .git && \
    rm -rf tests && \
    rm -rf scripts && \
    rm -rf docs && \
    rm -rf LOGSDOC

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