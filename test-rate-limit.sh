#!/bin/bash

echo "🚦 Probando Rate Limiting en producción..."
echo ""

API_URL="https://nomina-morchis-api.up.railway.app"

echo "1. 📊 Verificando configuración de Rate Limiting..."
curl -s "$API_URL/rate-limit-status" | jq .

echo ""
echo ""

echo "2. 🏥 Probando Health Check (sin rate limit)..."
for i in {1..5}; do
  echo "Request $i:"
  curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" "$API_URL/health" > /dev/null
  sleep 1
done

echo ""
echo ""

echo "3. 👥 Probando API de Employees (con rate limit permisivo)..."
for i in {1..10}; do
  echo "Request $i:"
  curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" \
    -H "Origin: https://nomina-morchis.vercel.app" \
    "$API_URL/api/employees?page=1&limit=10" > /dev/null
  sleep 0.5
done

echo ""
echo ""

echo "4. 🔐 Probando Auth (con rate limit más restrictivo)..."
for i in {1..5}; do
  echo "Request $i:"
  curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" \
    -H "Origin: https://nomina-morchis.vercel.app" \
    -H "Content-Type: application/json" \
    -X POST "$API_URL/api/auth/login" \
    -d '{"correo":"test","password":"test"}' > /dev/null
  sleep 1
done

echo ""
echo ""
echo "✅ Pruebas de Rate Limiting completadas"
echo "Si ves códigos 200/400 en lugar de 429, el rate limiting está funcionando correctamente"