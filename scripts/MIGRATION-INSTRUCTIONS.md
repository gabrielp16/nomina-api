# GUÍA DE MIGRACIÓN - EJECUTAR EN OTRA MÁQUINA

## 📋 Requisitos previos:
1. Node.js instalado
2. npm install mongoose
3. MongoDB local corriendo en la máquina origen (donde están los datos)

## � ALTERNATIVA: Migración usando archivos JSON

### **Opción A: Migración directa (requiere ambas máquinas conectadas)**
- Usa: `migrate-robust.js` (requiere que ambas máquinas estén online)

### **Opción B: Migración por archivos (recomendada para máquinas diferentes)**
- Máquina origen: `node export-to-files.js` → crea carpeta `backup-collections/`
- Copiar carpeta `backup-collections/` a la máquina destino
- Máquina destino: `node import-from-files.js` → importa a Atlas

### **Archivos exportados:**
```
📁 backup-collections/
├── 📄 activities.json (164.72 KB - 274 documentos)
├── 📄 employees.json (8.50 KB - 36 documentos)
├── 📄 payrolls.json (36.76 KB - 57 documentos)
├── 📄 permissions.json (8.61 KB - 29 documentos)
├── 📄 roles.json (5.34 KB - 10 documentos)
├── 📄 users.json (5.15 KB - 10 documentos)
└── 📄 export-summary.json (0.30 KB - metadatos)
```

## �🔧 Configuración de MongoDB Atlas:

### Connection String:
```
mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0
```

### ⚠️ IMPORTANTE - Configurar Network Access:

#### **Paso a paso en MongoDB Atlas:**

1. **Ir a MongoDB Atlas:**
   - Ve a https://cloud.mongodb.com/
   - Inicia sesión con tu cuenta

2. **Seleccionar proyecto:**
   - En el dashboard principal, selecciona tu proyecto
   - Deberías ver tu "Cluster0"

3. **Configurar Network Access:**
   - En el **menú lateral izquierdo**, busca "Network Access" 
   - (Puede estar bajo la sección "Security")
   - Haz clic en "Network Access"

4. **Agregar IP Address:**
   - Haz clic en el botón verde **"ADD IP ADDRESS"**
   - Se abrirá un modal con opciones

5. **Permitir acceso desde cualquier lugar:**
   - Selecciona **"ALLOW ACCESS FROM ANYWHERE"**
   - Esto añadirá automáticamente: `0.0.0.0/0`
   - **NO** selecciones "Add Current IP Address"

6. **Confirmar configuración:**
   - Haz clic en **"Confirm"**
   - Atlas mostrará "Updating..." o similar
   - **Espera 2-5 minutos** para que se aplique

7. **Verificar configuración:**
   - En Network Access deberías ver:
   ```
   IP Address: 0.0.0.0/0
   Comment: Allow access from anywhere
   Status: Active
   ```

#### **Verificar Database Access:**
- Ve a "Database Access" en el menú lateral
- Asegúrate de que tu usuario `gabrielp16` tenga:
  - **Database User Privileges**: "Atlas admin" o "Read and write to any database"
  - **Status**: Active

## 🚀 Pasos para ejecutar:

### Paso 1: Instalar dependencias
```bash
npm install mongoose
```

### Paso 2: Probar conexión
```bash
node test-atlas.js
```

### Paso 3: Ejecutar migración
```bash
node migrate-robust.js
```

## 📊 Datos esperados en migración:
- activities: ~274 documentos
- payrolls: ~57 documentos  
- roles: ~10 documentos
- employees: ~35 documentos
- permissions: ~29 documentos
- users: ~10 documentos

## ✅ Verificación post-migración:

### **1. Verificar en el script:**
- El script debe mostrar "¡MIGRACIÓN COMPLETADA EXITOSAMENTE!"
- Todos los documentos deben estar importados
- Ejecutar: `node test-atlas.js` para confirmar conexión

### **2. Verificar en MongoDB Atlas (Web):**
- Ve a https://cloud.mongodb.com/
- Selecciona tu proyecto → Cluster0
- Haz clic en **"Browse Collections"**
- Deberías ver la base de datos: **`morchis-nomina`**
- Con las colecciones:
  ```
  📂 activities (~274 documentos)
  📂 employees (~35 documentos)
  📂 payrolls (~57 documentos)
  📂 permissions (~29 documentos)
  📂 roles (~10 documentos)
  📂 users (~10 documentos)
  ```

### **3. Verificar con MongoDB Compass (Opcional):**
- Descargar: https://www.mongodb.com/try/download/compass
- Conectar con: `mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
- Seleccionar base de datos: `morchis-nomina`
- Verificar que todas las colecciones tengan datos

## 🆘 Troubleshooting:
- **Error de IP**: Configurar Network Access en Atlas
- **Error de conexión local**: Verificar que MongoDB esté corriendo
- **Error de autenticación**: Verificar credenciales de Atlas

## 📞 Notas adicionales:
- La migración elimina datos existentes en Atlas antes de importar
- Se ejecuta en lotes de 100 documentos para evitar timeouts
- Guarda un backup local antes de migrar (automático en el script)
