@echo off
echo 🚀 Iniciando migracion a MongoDB Atlas...

echo.
echo 📤 Paso 1: Exportando datos desde MongoDB local...
mongodump --host localhost:27017 --db morchis-nomina --out "./backup"

if %errorlevel% neq 0 (
    echo ❌ Error al exportar datos locales
    pause
    exit /b 1
)

echo ✅ Datos exportados exitosamente

echo.
echo 📥 Paso 2: Importando datos a MongoDB Atlas...
mongorestore --uri "mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" --db morchis-nomina "./backup/morchis-nomina" --drop

if %errorlevel% neq 0 (
    echo ❌ Error al importar datos a Atlas
    pause
    exit /b 1
)

echo.
echo 🎉 ¡Migración completada exitosamente!
echo 💾 Backup guardado en ./backup/
echo 🌐 Datos disponibles en MongoDB Atlas

pause
