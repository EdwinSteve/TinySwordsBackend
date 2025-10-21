#!/bin/sh
echo "🔧 Generando Prisma client..."
npm run prisma:generate

echo "📦 Ejecutando migraciones..."
npm run prisma:migrate

echo "🚀 Iniciando servidor..."
npm run start
