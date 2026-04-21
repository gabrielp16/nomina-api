# Plan De Ciclo De Vida, Estados Y Archivado De Trazabilidad

## Contexto Actual

El sistema actual ya no debe depender de un estado binario de pago para afectar inventario. Con el rediseño, el sistema debe distinguir estados operativos y financieros: `BORRADOR`, `RESERVADA`, `DESPACHADA`, `PAGADA`, `CERRADA` y `CANCELADA`.

Implicaciones observadas en el codigo actual:

- La salida de inventario ocurre al crear la orden.
- El pago no cambia el comportamiento logistico, solo el estado administrativo.
- Las ordenes pueden editarse o eliminarse despues de creadas, lo que restaura y vuelve a descontar inventario.
- La trazabilidad comercial ya vive dentro de la orden en cada item: producto, factura, lote, cantidad, precio y subtotal.
- `InventoryMovement` funciona como bitacora tecnica y de auditoria, no como fuente principal del stock actual.

## Problema De Modelo

En el modelo anterior, el estado de pago mezclaba dos conceptos distintos:

- Estado financiero: si el cliente ya pago.
- Estado operativo: si la mercancia ya salio y la orden ya no debe cambiar.

Eso generaba una ambiguedad importante. Por eso el modelo recomendado separa la salida fisica en `DESPACHADA`, el hito financiero en `PAGADA` y el cierre operativo final en `CERRADA`.

## 1. Politica De Ciclo De Vida Recomendada

Se recomienda separar el ciclo de vida de la orden en fases operativas y financieras.

Estados sugeridos:

1. `BORRADOR`
2. `RESERVADA`
3. `DESPACHADA`
4. `PAGADA`
5. `CERRADA`
6. `CANCELADA`

Significado operativo:

- `BORRADOR`: la orden esta en construccion. No descuenta inventario.
- `RESERVADA`: la orden fue confirmada comercialmente y queda separada del flujo de borrador. Reserva stock por lote de forma logica, pero no descuenta inventario fisico todavia.
- `DESPACHADA`: la mercancia realmente salio. Aqui debe ocurrir el descuento definitivo de inventario y nace la trazabilidad operativa obligatoria.
- `PAGADA`: se confirma el pago. No cambia la trazabilidad ni el movimiento fisico del stock.
- `CERRADA`: la orden ya termino financiera y operativamente. Desde aqui se puede bloquear edicion y preparar archivado de bitacoras tecnicas.
- `CANCELADA`: la orden se anula. Si ya habia afectado inventario, debe revertirse con movimientos compensatorios, nunca borrando historia.

Reglas recomendadas:

1. La trazabilidad no se elimina al pasar a `PAGADA`.
2. La trazabilidad critica de venta se conserva siempre dentro de la orden.
3. Solo una orden `CERRADA` debe considerarse candidata a archivo tecnico.
4. Una orden `DESPACHADA`, `PAGADA` o `CERRADA` no deberia permitir cambios libres de items y lotes.
5. Toda correccion posterior debe hacerse con eventos compensatorios, no reescribiendo historia silenciosamente.

## 2. Rediseño De Estados De Orden Para Este Proyecto

1. `BORRADOR`
2. `RESERVADA`
3. `DESPACHADA`
4. `PAGADA`
5. `CERRADA`
6. `CANCELADA`

Reglas para esta opcion:

- Crear o editar una orden en `BORRADOR` no toca inventario.
- Una orden `RESERVADA` no descuenta inventario fisico, pero si incrementa `reservedQuantity` en los lotes involucrados.
- Pasar a `DESPACHADA` crea los `InventoryMovement` de salida.
- Pasar a `PAGADA` solo registra el hito financiero.
- Pasar a `CERRADA` bloquea modificaciones y habilita archivado.
- Pasar a `CANCELADA` genera restauracion o reversal segun el punto del proceso.

## 3. Estrategia De Archivado De Trazabilidad

### Que Debe Conservarse Siempre

La trazabilidad comercial y sanitaria que vive en la orden no debe eliminarse:

- Cliente
- Fecha
- Producto
- Factura
- Lote
- Cantidad
- Precio
- Total
- Estado final

Eso permite responder preguntas como:

- Que lote se vendio a que cliente
- Que factura salio con ese lote
- Cuanto se vendio de un producto especifico
- Que ordenes participaron en un retiro o reclamo

### Que Si Puede Salir De La Coleccion Caliente

La bitacora tecnica `InventoryMovement` puede archivarse cuando ya no sea necesaria para operacion diaria.

Se recomienda mover a archivo solo movimientos que cumplan todo lo siguiente:

1. La orden asociada este en `CERRADA`
2. La orden tenga una antiguedad minima definida, por ejemplo 90 o 180 dias
3. No exista un proceso abierto de ajuste, reclamo o devolucion
4. El movimiento no sea necesario para una operacion de reversion pendiente

### Regla De Negocio Recomendada

No borrar trazabilidad; archivar en dos niveles:

1. Nivel comercial permanente en `Order`
2. Nivel tecnico historico en `InventoryMovementArchive`

### Modelo De Archivo Recomendado

Crear una coleccion `InventoryMovementArchive` con el mismo esquema base de `InventoryMovement`.

Proceso mensual sugerido:

1. Buscar movimientos asociados a ordenes `CERRADA` y mas antiguas que la ventana definida
2. Copiarlos a `InventoryMovementArchive`
3. Verificar conteo e integridad
4. Eliminar esos documentos de `InventoryMovement`
5. Guardar log del lote archivado

### Ventana Operativa Sugerida

- Coleccion caliente: ultimos 6 a 12 meses
- Archivo: todo lo anterior
- Purga final: solo si negocio, auditoria y regulacion lo permiten

## Reglas Especificas Sobre Eliminacion De Trazabilidad

No se recomienda eliminar trazabilidad en estos casos:

1. Al cambiar una orden de `DESPACHADA` a `PAGADA`
2. Al cerrar una venta
3. Al agotar el inventario del lote
4. Al eliminar visualmente un registro que aun puede ser auditado

Solo se recomienda eliminar fisicamente bitacora tecnica cuando:

1. Ya exista copia valida en archivo
2. El periodo operativo haya expirado
3. No haya dependencia funcional en el sistema activo
4. La politica legal y contable lo permita

## Ajustes Tecnicos Recomendados Antes De Archivar

1. Bloquear edicion y eliminacion de ordenes cuando entren a estado final
2. Agregar `closedAt` o `finalizedAt` en la orden
3. Agregar indice por `metadata.orderId` en `InventoryMovement` si se va a usar para archivado por orden
4. Revisar indices existentes que hoy no sostienen consultas reales
5. Crear script de archivado por lotes con reintentos y validacion de conteo

## Ruta Recomendada De Implementacion

### Fase 1

1. Agregar estado `CERRADA`
2. Impedir editar y eliminar ordenes `CERRADA` o `CANCELADA`
3. Mantener la trazabilidad tal como esta

### Fase 2

1. Agregar campo `closedAt`
2. Crear `InventoryMovementArchive`
3. Crear script de archivado mensual

### Fase 3

1. Evaluar si el modelo debe migrar a `DESPACHADA` separado de `PAGADA`
2. Mover el descuento de inventario al evento de despacho si el negocio lo requiere
3. Dejar `PAGADA` como estado financiero puro

## Conclusiones

1. `PAGADA` no debe eliminar trazabilidad.
2. El estado de pago no reemplaza el historial logistico ni sanitario.
3. La orden ya contiene la trazabilidad comercial critica y debe conservarla.
4. La coleccion `InventoryMovement` si puede salir del hot path mediante archivado controlado.
5. La mejor frontera para archivar no es `PAGADA`, sino `CERRADA`.