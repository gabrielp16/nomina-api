# API de Precios de Productos

## Descripción
Sistema de gestión de precios por cliente para productos. Permite definir precios específicos de cada producto para cada cliente.

## Modelo de Datos

### ProductPrice
```typescript
{
  producto: ObjectId,      // Referencia al producto
  cliente: ObjectId,       // Referencia al cliente
  precio: Number,          // Precio específico para este cliente-producto
  activo: Boolean,         // Estado del precio (default: true)
  createdAt: Date,         // Fecha de creación
  updatedAt: Date          // Fecha de última actualización
}
```

### Product (actualizado)
```typescript
{
  nombre: String,
  descripcion?: String,
  unidad: String,
  activo: Boolean,
  preciosPorCliente?: Array<{
    cliente: string,
    valor: number,
    id_producto: string,
    producto: string
  }>
}
```

## Endpoints

### 1. Obtener todos los precios
**GET** `/api/product-prices`

**Permisos requeridos:** `READ_PAYROLL`

**Query params:**
- `producto` (opcional): ID del producto para filtrar
- `cliente` (opcional): ID del cliente para filtrar
- `activo` (opcional): true/false para filtrar por estado

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "producto": {
        "_id": "...",
        "nombre": "Producto A",
        "unidad": "KG"
      },
      "cliente": {
        "_id": "...",
        "nombre": "Cliente X",
        "nit": "123456789"
      },
      "precio": 150.50,
      "activo": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 2. Obtener precios por producto
**GET** `/api/product-prices/producto/:id`

**Permisos requeridos:** `READ_PAYROLL`

**Params:**
- `id`: ID del producto

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "producto": {
      "_id": "...",
      "nombre": "Producto A",
      "unidad": "KG",
      "descripcion": "Descripción del producto"
    },
    "preciosPorCliente": [
      {
        "cliente": "Cliente X",
        "valor": 150.50,
        "id_producto": "...",
        "producto": "Producto A",
        "clienteId": "...",
        "nit": "123456789",
        "precioId": "..."
      }
    ]
  }
}
```

### 3. Obtener precios por cliente
**GET** `/api/product-prices/cliente/:id`

**Permisos requeridos:** `READ_PAYROLL`

**Params:**
- `id`: ID del cliente

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "cliente": {
      "_id": "...",
      "nombre": "Cliente X",
      "nit": "123456789"
    },
    "precios": [
      {
        "_id": "...",
        "producto": "Producto A",
        "productoId": "...",
        "unidad": "KG",
        "precio": 150.50,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 4. Crear nuevo precio
**POST** `/api/product-prices`

**Permisos requeridos:** `MANAGE_PAYROLL`

**Body:**
```json
{
  "producto": "producto_id",
  "cliente": "cliente_id",
  "precio": 150.50
}
```

**Validaciones:**
- `producto`: Requerido, debe ser un ObjectId válido, el producto debe existir
- `cliente`: Requerido, debe ser un ObjectId válido, el cliente debe existir
- `precio`: Requerido, debe ser un número positivo (≥ 0)
- No puede haber duplicados activos de cliente-producto

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Precio creado exitosamente",
  "data": {
    "_id": "...",
    "producto": {
      "_id": "...",
      "nombre": "Producto A",
      "unidad": "KG"
    },
    "cliente": {
      "_id": "...",
      "nombre": "Cliente X",
      "nit": "123456789"
    },
    "precio": 150.50,
    "activo": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 5. Actualizar precio
**PUT** `/api/product-prices/:id`

**Permisos requeridos:** `MANAGE_PAYROLL`

**Params:**
- `id`: ID del precio a actualizar

**Body:**
```json
{
  "precio": 175.00
}
```

**Validaciones:**
- `precio`: Requerido, debe ser un número positivo (≥ 0)

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Precio actualizado exitosamente",
  "data": {
    "_id": "...",
    "producto": {
      "_id": "...",
      "nombre": "Producto A",
      "unidad": "KG"
    },
    "cliente": {
      "_id": "...",
      "nombre": "Cliente X",
      "nit": "123456789"
    },
    "precio": 175.00,
    "activo": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### 6. Desactivar precio (soft delete)
**DELETE** `/api/product-prices/:id`

**Permisos requeridos:** `MANAGE_PAYROLL`

**Params:**
- `id`: ID del precio a desactivar

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Precio desactivado exitosamente"
}
```

## Índices de Base de Datos

El modelo tiene los siguientes índices para optimizar búsquedas:

1. **Índice único compuesto:** `{ producto: 1, cliente: 1, activo: 1 }`
   - Garantiza que no haya duplicados activos de cliente-producto
   
2. **Índice simple:** `{ producto: 1 }`
   - Optimiza búsquedas por producto
   
3. **Índice simple:** `{ cliente: 1 }`
   - Optimiza búsquedas por cliente

## Permisos del Sistema

Los endpoints de precios utilizan los siguientes permisos existentes:

- **READ_PAYROLL**: Permite ver precios (GET endpoints)
- **UPDATE_PAYROLL**: Permite actualizar precios existentes
- **MANAGE_PAYROLL**: Permite crear, actualizar y eliminar precios

### Roles con acceso

- **Super Administrador**: Acceso completo (READ, UPDATE, MANAGE)
- **Contador**: Acceso completo (READ, UPDATE, MANAGE)
- **Supervisor**: Lectura y actualización (READ, UPDATE)
- **Empleado**: Lectura y actualización (READ, UPDATE)
- **Usuario**: Solo lectura (READ)

## Logging de Actividades

Todas las operaciones CUD (Create, Update, Delete) se registran automáticamente en el log de actividades:

- **CREATE**: Al crear un nuevo precio
- **UPDATE**: Al actualizar un precio existente
- **DELETE**: Al desactivar un precio

## Códigos de Error

- **400**: Validación fallida o precio duplicado
- **401**: No autenticado
- **403**: Sin permisos suficientes
- **404**: Producto, cliente o precio no encontrado
- **500**: Error interno del servidor

## Ejemplos de Uso

### Crear precio para un cliente específico
```bash
curl -X POST http://localhost:3001/api/product-prices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "producto": "producto_id",
    "cliente": "cliente_id",
    "precio": 150.50
  }'
```

### Obtener todos los precios de un producto
```bash
curl -X GET "http://localhost:3001/api/product-prices?producto=producto_id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Actualizar precio existente
```bash
curl -X PUT http://localhost:3001/api/product-prices/precio_id \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precio": 175.00
  }'
```

## Integración con el Sistema de Órdenes

Al crear una orden, el sistema puede:
1. Buscar si existe un precio específico para ese cliente-producto
2. Si existe, usar ese precio
3. Si no existe, solicitar al usuario que ingrese el precio manualmente

Ejemplo de lógica en el frontend:
```typescript
async function getProductPriceForClient(productoId: string, clienteId: string) {
  const response = await fetch(
    `/api/product-prices?producto=${productoId}&cliente=${clienteId}&activo=true`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const { data } = await response.json();
  
  if (data && data.length > 0) {
    return data[0].precio; // Precio específico encontrado
  }
  
  return null; // No hay precio específico, usar manual
}
```
