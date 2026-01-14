#!/bin/sh

echo "🔧 Instalando dependencias..."
npm install

echo "🧬 Ejecutando migraciones..."
npx prisma migrate deploy

echo "🚀 Iniciando servidor..."
npm run start
