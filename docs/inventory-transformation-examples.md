# Ejemplos de Transformacion FIFO con Trazabilidad de Lotes

## 1) Estado inicial (antes de transformar)

```json
{
  "inventory": [
    {
      "id": "inv_lot_a",
      "product": "Bolitas 30gr",
      "lotNumber": "20260301-BOME01",
      "quantity": 6,
      "expirationDate": "2026/09/01"
    },
    {
      "id": "inv_lot_b",
      "product": "Bolitas 30gr",
      "lotNumber": "20260303-BOME01",
      "quantity": 20,
      "expirationDate": "2026/09/03"
    }
  ]
}
```

## 2) Crear 2 unidades de Morchis TO-GO! - Bolitas (requiere 20 unidades base)

FIFO real:

- Consume 6 unidades del lote `20260301-BOME01` (primero en entrar)
- Consume 14 unidades del lote `20260303-BOME01`

```json
{
  "inventory": {
    "id": "inv_pkg_1",
    "product": "Morchis TO-GO! - Bolitas",
    "lotNumber": "20260407-GOBO01",
    "quantity": 2,
    "transformationSources": [
      {
        "inventoryId": "inv_lot_a",
        "lotNumber": "20260301-BOME01",
        "quantity": 6
      },
      {
        "inventoryId": "inv_lot_b",
        "lotNumber": "20260303-BOME01",
        "quantity": 14
      }
    ]
  },
  "inventoryMovement": {
    "movementType": "TRANSFORMATION",
    "reason": "PACKAGED_PRODUCT_CREATED",
    "sourceLots": [
      {
        "inventoryId": "inv_lot_a",
        "lotNumber": "20260301-BOME01",
        "quantity": 6
      },
      {
        "inventoryId": "inv_lot_b",
        "lotNumber": "20260303-BOME01",
        "quantity": 14
      }
    ],
    "targetLots": [
      {
        "inventoryId": "inv_pkg_1",
        "lotNumber": "20260407-GOBO01",
        "quantity": 2
      }
    ]
  }
}
```

## 3) Estado luego de la transformacion

```json
{
  "inventory": [
    {
      "id": "inv_lot_a",
      "product": "Bolitas 30gr",
      "lotNumber": "20260301-BOME01",
      "quantity": 0
    },
    {
      "id": "inv_lot_b",
      "product": "Bolitas 30gr",
      "lotNumber": "20260303-BOME01",
      "quantity": 6
    },
    {
      "id": "inv_pkg_1",
      "product": "Morchis TO-GO! - Bolitas",
      "lotNumber": "20260407-GOBO01",
      "quantity": 2
    }
  ]
}
```

Nota:

- El lote agotado no se elimina; se mantiene en 0 para historial y trazabilidad.

## 4) Revertir/eliminar el empaquetado

```json
{
  "inventoryMovement": {
    "movementType": "TRANSFORMATION",
    "reason": "PACKAGED_PRODUCT_REVERTED",
    "sourceLots": [
      {
        "inventoryId": "inv_pkg_1",
        "lotNumber": "20260407-GOBO01",
        "quantity": 2
      }
    ],
    "targetLots": [
      {
        "inventoryId": "inv_lot_a",
        "lotNumber": "20260301-BOME01",
        "quantity": 6
      },
      {
        "inventoryId": "inv_lot_b",
        "lotNumber": "20260303-BOME01",
        "quantity": 14
      }
    ]
  }
}
```

Resultado de reversa:

- `inv_lot_a` vuelve a 6
- `inv_lot_b` vuelve a 20
- No se crea ningun lote nuevo
