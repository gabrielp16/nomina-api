# Script de Migración a MongoDB Atlas

## Instrucciones paso a paso:

### 1. Preparar el connection string de Atlas
```bash
# En tu terminal, configura la variable de entorno con tu connection string de Atlas
set MONGODB_URI=mongodb+srv://nomina_admin:<TU_PASSWORD>@morchis-nomina.xxxxx.mongodb.net/morchis-nomina?retryWrites=true&w=majority
```

### 2. Ejecutar la migración
```bash
# Desde la carpeta server
cd server
node scripts/migrate-to-atlas.js
```

### 3. Verificar la migración
El script creará un archivo `backup-data.json` como respaldo de tus datos locales.

## Comandos alternativos:

### Solo exportar datos (crear backup)
```bash
node -e "require('./scripts/migrate-to-atlas.js').exportFromLocal()"
```

### Solo importar datos (desde backup)
```bash
node -e "
const data = require('./scripts/backup-data.json');
require('./scripts/migrate-to-atlas.js').importToAtlas(data);
"
```

## Qué hace el script:

1. **Exporta** todos los datos de tu MongoDB local:
   - Usuarios
   - Empleados  
   - Roles
   - Permisos
   - Actividades

2. **Crea un backup** en formato JSON

3. **Importa** los datos a MongoDB Atlas

4. **Verifica** que todo se migró correctamente

## Troubleshooting:

### Error de conexión local:
- Asegúrate de que MongoDB local esté corriendo
- Verifica que el puerto 27017 esté disponible

### Error de conexión Atlas:
- Verifica tu connection string
- Asegúrate de que la IP esté en la whitelist (0.0.0.0/0)
- Confirma usuario y password correctos

### Error de permisos:
- El usuario de Atlas debe tener permisos de lectura/escritura
- Recomendado: Atlas Admin para la migración
