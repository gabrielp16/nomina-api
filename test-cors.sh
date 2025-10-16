#!/bin/bash

echo "🔍 Probando configuración CORS en producción..."
echo ""

API_URL="https://nomina-morchis-api.up.railway.app"
FRONTEND_URL="https://nomina-morchis.vercel.app"

echo "1. 🏥 Probando Health Check..."
curl -s -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -X OPTIONS "$API_URL/health"

echo ""
echo ""

echo "2. 🧪 Probando CORS Test Endpoint..."
curl -s -H "Origin: $FRONTEND_URL" "$API_URL/cors-test"

echo ""
echo ""

echo "3. 🔐 Probando Auth Preflight..."
curl -s -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -X OPTIONS "$API_URL/api/auth/login"

echo ""
echo ""

echo "4. 📊 Probando Login Request Real..."
curl -s -H "Origin: $FRONTEND_URL" \
  -H "Content-Type: application/json" \
  -X POST "$API_URL/api/auth/login" \
  -d '{"correo":"admin@morchis.com","password":"admin123"}'

echo ""
echo ""
echo "✅ Pruebas CORS completadas"