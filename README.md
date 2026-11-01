# Backend de Recepción – Pizzería

API REST (Node.js + Express + MySQL) del módulo de **Recepción**: registrar pedidos presenciales, ver los pedidos activos, enviar a reparto, confirmar entrega y cancelar.

Es la parte del backend central (`pizzeria-backend`) que usa el front de recepción. **No incluye** las rutas de Clientes (cuentas y sesión) ni las de Cocina.

> Los pedidos pasan por Cocina entre `REGISTRADO` y `LISTO`. Para ese tramo necesitas el backend de cocina (o el completo) sobre la misma base `pizzeria_db`.

## Requisitos

- Node.js 18 o superior
- MySQL 8 o superior con la base `pizzeria_db` creada (script `database/instalacion.sql` del proyecto)

Tablas que usa: `orders`, `order_items` y `products`. `orders` necesita las columnas `customer_id`, `estimated_minutes`, `kitchen_started_at`, `oven_started_at` y `ready_at`; el servidor avisa al arrancar si faltan.

## Instalación

```bash
cp .env.example .env     # y edita DB_PASSWORD con tu contraseña de MySQL
npm install
npm start
```

Al arrancar debe mostrar `Backend de Recepción corriendo en http://localhost:3000` y `Conectado exitosamente a MySQL.`

| Variable      | Valor por defecto | Descripción          |
| ------------- | ----------------- | -------------------- |
| `PORT`        | `3000`            | Puerto del servidor  |
| `DB_HOST`     | `127.0.0.1`       | Servidor MySQL       |
| `DB_PORT`     | `3306`            | Puerto MySQL         |
| `DB_USER`     | `root`            | Usuario MySQL        |
| `DB_PASSWORD` | (vacío)           | Contraseña MySQL     |
| `DB_NAME`     | `pizzeria_db`     | Nombre de la base    |

No subas `.env` al repositorio.

## Comprobar que funciona

<http://localhost:3000/api/v1/health> debe responder `{"ok":true,"database":"connected"}`.

## Endpoints

Base: `/api/v1`. Los errores tienen la forma `{ "error": "mensaje" }`. No requieren sesión.

| Método | Ruta                  | Descripción |
| ------ | --------------------- | ----------- |
| GET    | `/health`             | Estado del servidor y la base |
| POST   | `/orders`             | Registra un pedido presencial |
| GET    | `/orders/active`      | Pedidos que no están `COMPLETADO` ni `CANCELADO`, del más nuevo al más antiguo, con sus `items` |
| PATCH  | `/orders/:id/status`  | Cambia el estado del pedido |

### Registrar pedido: `POST /orders`
```json
{
  "order_type": "DOMICILIO",
  "customer_name": "Ana López",
  "customer_phone": "9611234567",
  "delivery_address": "Calle 1 #23, Col. Centro",
  "payment_method": "EFECTIVO",
  "items": [ { "product_id": 1, "quantity": 2, "notes": "Sin cebolla" } ]
}
```
- `order_type`: `LOCAL`, `PARA_LLEVAR` o `DOMICILIO`.
- `customer_name` es obligatorio. En `DOMICILIO` también son obligatorios `customer_phone` y `delivery_address`.
- `payment_method` (opcional): `EFECTIVO`, `TARJETA` o `TRANSFERENCIA`.
- `items`: al menos uno, con `quantity` entera de 1 a 99. Solo se aceptan productos existentes y disponibles.
- Los precios y el total **los calcula el servidor** con MySQL, y el pedido se guarda en una transacción.

Responde `201`:
```json
{ "message": "Pedido creado con éxito", "order_id": 1, "folio": "PED-0001", "total_amount": 350 }
```

### Pedidos activos: `GET /orders/active`
Cada pedido trae sus columnas de `orders`, `remaining_seconds` y `oven_elapsed_seconds` (cuando está en cocina) y sus `items` con `product_name`.

### Cambiar estado: `PATCH /orders/:id/status`
```json
{ "status": "COMPLETADO" }
```
`status` debe ser `REGISTRADO`, `EN_COCINA`, `LISTO`, `EN_REPARTO`, `COMPLETADO` o `CANCELADO`. Solo se permiten estas transiciones:

| Desde        | Hacia |
| ------------ | ----- |
| `REGISTRADO` | `EN_COCINA`, `CANCELADO` |
| `EN_COCINA`  | `LISTO` |
| `LISTO`      | `EN_REPARTO` (si es `DOMICILIO`) o `COMPLETADO` (local / para llevar) |
| `EN_REPARTO` | `COMPLETADO` |

Una transición no permitida responde `409`; un pedido inexistente, `404`. El cambio comprueba el estado anterior, así que dos pantallas no se pisan.

**Acciones de la pantalla de recepción:** enviar a reparto (`LISTO` → `EN_REPARTO`), confirmar entrega (`LISTO` o `EN_REPARTO` → `COMPLETADO`) y cancelar (`REGISTRADO` → `CANCELADO`).

> Este endpoint también acepta `EN_COCINA` y `LISTO`, y eso salta el flujo normal de cocina. La pantalla de recepción no lo usa, pero la API no lo impide.

## Flujo del pedido

```
Local / Para llevar:  REGISTRADO → EN_COCINA → LISTO → COMPLETADO
A domicilio:          REGISTRADO → EN_COCINA → LISTO → EN_REPARTO → COMPLETADO
Cancelación:          REGISTRADO → CANCELADO
```

## Front de recepción

Si existe la carpeta `../FrontendPizzeria-feature-recepcion`, el servidor la publica y redirige `/` a <http://localhost:3000/pages/recepcion.html>. Debe quedar junto a esta carpeta:

```
Pizzeria_Integrada/
├── pizzeria-backend-recepcion/
└── FrontendPizzeria-feature-recepcion/
```

El front consulta los pedidos activos cada 10 segundos.

## Problemas comunes

| Problema | Qué revisar |
| -------- | ----------- |
| `ECONNREFUSED` | MySQL apagado o `DB_HOST`/`DB_PORT` incorrectos. |
| `Access denied` | `DB_USER` / `DB_PASSWORD` en `.env`. |
| `Unknown database pizzeria_db` | Falta ejecutar `database/instalacion.sql`. |
| Aviso "Faltan columnas/tablas…" | Ejecuta `instalacion.sql` o las migraciones de `database/migraciones/`. |
| "Productos inexistentes o no disponibles" | Revisa `products` y que `available = 1`. |
| Un pedido no avanza de `REGISTRADO` | Cocina debe tomarlo; recepción no hace ese paso. |
