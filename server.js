// Sprint 2 - Módulo cliente: menú (PB-03), pedido/pago/estado (PB-06), descuentos/progreso (PB-07)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
// CORS: permite que el frontend de otro dominio use esta API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Datos fijos ----------
const MENU = [
  { id: 1, nombre: 'Pepperoni', precio: 150, ingredientes: ['Queso mozzarella', 'Pepperoni', 'Salsa de tomate'] },
  { id: 2, nombre: 'Hawaiana', precio: 145, ingredientes: ['Queso mozzarella', 'Jamón', 'Piña', 'Salsa de tomate'] },
  { id: 3, nombre: 'Queso', precio: 130, ingredientes: ['Queso mozzarella', 'Queso cheddar', 'Salsa de tomate'] },
  { id: 4, nombre: 'Mexicana', precio: 165, ingredientes: ['Chorizo', 'Jalapeño', 'Cebolla', 'Queso mozzarella'] }
];
const DESCUENTOS = [
  { codigo: 'PIZZA10', descripcion: '10% de descuento en tu pedido', porcentaje: 10, minPizzas: 1 },
  { codigo: 'DOS25', descripcion: '25% de descuento al pedir 2 o más pizzas', porcentaje: 25, minPizzas: 2 }
];
const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
// Mismos estados que usa recepción
const PROGRESO = { EN_PREPARACION: 33, LISTO: 66, ENTREGADO: 100 };

// ---------- Persistencia simple en archivo ----------
let db = { siguienteId: 1, pedidos: [] };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const guardar = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const conProgreso = p => ({ ...p, progreso: PROGRESO[p.estado] });

// ---------- API ----------
app.get('/api/menu', (req, res) => res.json(MENU));
app.get('/api/descuentos', (req, res) => res.json(DESCUENTOS));
app.get('/api/pagos/metodos', (req, res) => res.json(METODOS_PAGO));

app.post('/api/pedidos', (req, res) => {
  const { cliente, items, metodoPago, codigo } = req.body || {};
  if (!cliente || !String(cliente).trim()) return res.status(400).json({ error: 'Falta el nombre del cliente' });
  if (!METODOS_PAGO.includes(metodoPago)) return res.status(400).json({ error: 'Método de pago inválido' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El pedido está vacío' });

  let subtotal = 0, pizzas = 0;
  const lineas = [];
  for (const it of items) {
    const pizza = MENU.find(m => m.id === it.id);
    const cant = Number(it.cantidad);
    if (!pizza || !Number.isInteger(cant) || cant < 1 || cant > 20)
      return res.status(400).json({ error: 'Producto o cantidad inválida' });
    subtotal += pizza.precio * cant;
    pizzas += cant;
    lineas.push({ id: pizza.id, nombre: pizza.nombre, cantidad: cant, precio: pizza.precio });
  }

  let descuento = 0, codigoAplicado = null;
  if (codigo && String(codigo).trim()) {
    const d = DESCUENTOS.find(x => x.codigo === String(codigo).trim().toUpperCase());
    if (!d) return res.status(400).json({ error: 'Código de descuento no válido' });
    if (pizzas < d.minPizzas) return res.status(400).json({ error: `El código requiere al menos ${d.minPizzas} pizzas` });
    descuento = +(subtotal * d.porcentaje / 100).toFixed(2);
    codigoAplicado = d.codigo;
  }

  const pedido = {
    id: db.siguienteId++,
    cliente: String(cliente).trim().slice(0, 80),
    // "detalle" y "estado" igual que en recepción, para poder integrarlos
    detalle: lineas.map(l => `${l.cantidad}x ${l.nombre}`).join(', '),
    hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }),
    creadoEn: Date.now(),
    estado: 'EN_PREPARACION',
    items: lineas,
    subtotal, descuento, codigo: codigoAplicado,
    total: +(subtotal - descuento).toFixed(2),
    metodoPago,
    pagado: metodoPago !== 'EFECTIVO' // pago simulado: efectivo se paga al recoger
  };
  db.pedidos.unshift(pedido);
  guardar();
  res.status(201).json(conProgreso(pedido));
});

app.get('/api/pedidos/:id', (req, res) => {
  const p = db.pedidos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(conProgreso(p));
});

// Solo para pruebas/demo: simula que cocina/recepción cambia el estado
app.patch('/api/pedidos/:id/estado', (req, res) => {
  const p = db.pedidos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!PROGRESO[req.body.estado]) return res.status(400).json({ error: 'Estado inválido' });
  p.estado = req.body.estado;
  guardar();
  res.json(conProgreso(p));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}/cliente.html`));