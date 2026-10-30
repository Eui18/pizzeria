const $ = id => document.getElementById(id);
const dinero = n => `$${Number(n).toFixed(2)}`;
const CLAVE = 'buenaPizzaPedidos';

let carrito = {};
let cuponDescuento = 0;
let rastreoInterval = null;
let vistaActual = 'menu';

// Los pedidos se guardan en el navegador para que no se pierdan al recargar
let dbPedidos = {};
try { dbPedidos = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { dbPedidos = {}; }
const guardarPedidos = () => { try { localStorage.setItem(CLAVE, JSON.stringify(dbPedidos)); } catch { /* sin almacenamiento */ } };

const menu = [
  { id: 1, nombre: 'Margarita Clásica', ingredientes: ['Salsa de tomate', 'Queso Mozzarella', 'Albahaca'], precio: 120 },
  { id: 2, nombre: 'Pepperoni Furioso', ingredientes: ['Doble pepperoni', 'Extra queso'], precio: 145 },
  { id: 3, nombre: 'La Hawaiana', ingredientes: ['Jamón ahumado', 'Piña asada'], precio: 135 },
  { id: 4, nombre: 'Veggie Suprema', ingredientes: ['Pimientos', 'Champiñones', 'Cebolla morada'], precio: 130 },
  { id: 5, nombre: 'Carnívora', ingredientes: ['Pepperoni', 'Salami', 'Tocino', 'Carne'], precio: 165 },
  { id: 6, nombre: 'Cuatro Quesos', ingredientes: ['Mozzarella', 'Parmesano', 'Gouda', 'Roquefort'], precio: 155 },
  { id: 7, nombre: 'Mexicana', ingredientes: ['Chorizo', 'Jalapeños', 'Cebolla', 'Frijoles'], precio: 150 },
  { id: 8, nombre: 'BBQ Pollo', ingredientes: ['Pollo asado', 'Salsa BBQ', 'Cebolla caramelizada'], precio: 160 }
];

// ---------- Pizzas dibujadas (cada sabor con sus ingredientes) ----------
const PUNTOS = [[100, 52], [142, 76], [150, 118], [120, 150], [78, 150], [50, 118], [58, 76], [100, 100], [124, 100], [76, 100]];
const FORMAS = {
  c: (p, f, s) => `<circle cx="${p[0]}" cy="${p[1]}" r="11" fill="${f}" stroke="${s}" stroke-width="2"/>`,
  r: (p, f, s) => `<rect x="${p[0] - 8}" y="${p[1] - 8}" width="16" height="16" rx="3" fill="${f}" stroke="${s}" stroke-width="2"/>`,
  t: (p, f, s) => `<path d="M${p[0] - 9} ${p[1] + 8}l9-16 9 16z" fill="${f}" stroke="${s}" stroke-width="2"/>`,
  o: (p, f) => `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="none" stroke="${f}" stroke-width="4"/>`,
  e: (p, f, s) => `<ellipse cx="${p[0]}" cy="${p[1]}" rx="12" ry="8" fill="${f}" stroke="${s}" stroke-width="1.5"/>`
};
const RECETAS = {
  1: [['e', '#fff6dc', '#e8d9a8'], ['o', '#2f9e44']],
  2: [['c', '#c0392b', '#922b21']],
  3: [['r', '#f29a9a', '#d96b6b'], ['t', '#f7d44c', '#d4a017']],
  4: [['o', '#2f9e44'], ['c', '#cdb79e', '#a58e74'], ['o', '#8e44ad']],
  5: [['c', '#c0392b', '#922b21'], ['r', '#7a3b1d', '#5a2a14'], ['e', '#e8a0a0', '#c97a7a']],
  6: [['e', '#fff6dc', '#e8d9a8'], ['e', '#f9e29b', '#e0c060'], ['e', '#f6b26b', '#d98a3a']],
  7: [['c', '#a93226', '#7b241c'], ['o', '#2f9e44']],
  8: [['e', '#f0d9b5', '#d2b48c'], ['o', '#b03a8c'], ['c', '#6b3a1e', '#4a2a12']]
};

function pizzaSVG(id) {
  const receta = RECETAS[id] || RECETAS[2];
  const toppings = PUNTOS.map((p, i) => {
    const [k, f, s] = receta[i % receta.length];
    return FORMAS[k](p, f, s);
  }).join('');
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="94" fill="#e3a857" stroke="#b9772e" stroke-width="4"/>
    <circle cx="100" cy="100" r="80" fill="#d9432b"/>
    <circle cx="100" cy="100" r="74" fill="#f8c24a"/>
    ${toppings}
    <path d="M100 26V174M26 100H174M48 48L152 152M152 48L48 152" stroke="#d89b1f" stroke-width="2" opacity=".55"/>
  </svg>`;
}

// ---------- Cálculos ----------
function calcular() {
  const subtotal = menu.reduce((s, p) => s + p.precio * (carrito[p.id] || 0), 0);
  const descuento = subtotal * cuponDescuento;
  const cantidad = Object.values(carrito).reduce((a, b) => a + b, 0);
  return { subtotal, descuento, total: subtotal - descuento, cantidad };
}

// ---------- Navegación ----------
function mostrar(vista) {
  vistaActual = vista;
  document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== 'vista-' + vista; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('activa', t.dataset.vista === vista));
  if (vista === 'carrito') pintarTicket();
  if (vista !== 'estado') clearInterval(rastreoInterval);
  actualizarBarra();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.vista)));

// ---------- Carrito ----------
function cambiarCarrito(id, d) {
  carrito[id] = Math.max(0, (carrito[id] || 0) + d);
  pintarMenu();
  actualizarBarra();
  if (vistaActual === 'carrito') pintarTicket();
}

function actualizarBarra() {
  const { total, cantidad } = calcular();
  $('contador').textContent = cantidad;
  $('barraCant').textContent = cantidad;
  $('barraTotal').textContent = dinero(total);
  $('carritoBarra').hidden = cantidad === 0 || vistaActual !== 'menu';
}

function pintarMenu() {
  $('menu').innerHTML = menu.map(p => {
    const cant = carrito[p.id] || 0;
    return `
    <article class="card-pizza">
      <div class="foto-pizza">
        <div class="plato">${pizzaSVG(p.id)}${cant ? `<span class="cant">×${cant}</span>` : ''}</div>
      </div>
      <h3>${p.nombre}</h3>
      <p class="ingredientes">${p.ingredientes.join(', ')}</p>
      <div class="precio-btn">
        <span class="precio-tag">${dinero(p.precio)}</span>
        <div class="ctrl">
          ${cant ? `<button class="btn-redondo" aria-label="Quitar una ${p.nombre}" onclick="cambiarCarrito(${p.id}, -1)">−</button>` : ''}
          <button class="btn-agregar" onclick="cambiarCarrito(${p.id}, 1)">Agregar pizza</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function pintarTicket() {
  const { subtotal, descuento, total } = calcular();
  const items = menu.filter(p => carrito[p.id]);

  $('resumen').innerHTML = items.length
    ? items.map(p => `
      <li class="linea">
        <div class="mini">${pizzaSVG(p.id)}</div>
        <div><strong>${p.nombre}</strong><small>${dinero(p.precio)} c/u</small></div>
        <div class="stepper">
          <button class="btn-redondo" aria-label="Quitar una ${p.nombre}" onclick="cambiarCarrito(${p.id}, -1)">−</button>
          <b>${carrito[p.id]}</b>
          <button class="btn-redondo" aria-label="Agregar una ${p.nombre}" onclick="cambiarCarrito(${p.id}, 1)">+</button>
        </div>
        <span class="linea-precio">${dinero(p.precio * carrito[p.id])}</span>
      </li>`).join('')
    : '<li class="vacio">Tu ticket está vacío. Agrega pizzas desde el menú.</li>';

  $('subtotal').textContent = dinero(subtotal);
  $('descuento-aplicado').textContent = `-${dinero(descuento)}`;
  $('total-final').textContent = dinero(total);
  $('fila-descuento').hidden = cuponDescuento === 0;
}

// ---------- Cupón ----------
let cuponTimer = null;
$('btnAplicarCupon').addEventListener('click', () => {
  const codigo = $('codigo').value.trim().toUpperCase();
  const boton = $('btnAplicarCupon');
  clearTimeout(cuponTimer);
  $('codigo').classList.remove('ok', 'mal');
  boton.classList.remove('ok', 'mal');

  if (codigo === 'PIZZA20') {
    cuponDescuento = 0.20;
    $('codigo').classList.add('ok');
    boton.classList.add('ok');
    boton.textContent = '¡Aplicado!';
  } else {
    cuponDescuento = 0;
    $('codigo').classList.add('mal');
    boton.classList.add('mal');
    boton.textContent = 'Inválido';
    cuponTimer = setTimeout(() => {
      boton.textContent = 'Aplicar';
      boton.classList.remove('mal');
      $('codigo').classList.remove('mal');
    }, 2000);
  }
  pintarTicket();
});

// ---------- Pago ----------
const esperar = ms => new Promise(res => setTimeout(res, ms));

function folioNuevo() {
  let f;
  do { f = 'PED-' + (Math.floor(Math.random() * 9000) + 1000); } while (dbPedidos[f]);
  return f;
}

$('formPedido').addEventListener('submit', async e => {
  e.preventDefault();
  const { total, cantidad } = calcular();
  if (cantidad === 0) return alert('Agrega pizzas primero');

  $('btnPagar').disabled = true;
  $('modalProcesando').hidden = false;
  await esperar(2000);
  $('modalTexto').textContent = '¡Pedido confirmado!';
  $('modalTexto').classList.add('listo');
  await esperar(1000);

  const folio = folioNuevo();
  dbPedidos[folio] = {
    cliente: $('cliente').value.trim(),
    metodo: $('metodoPago').value,
    total,
    horaCreacion: Date.now()
  };
  guardarPedidos();

  carrito = {};
  cuponDescuento = 0;
  $('formPedido').reset();
  $('btnAplicarCupon').textContent = 'Aplicar';
  $('btnAplicarCupon').classList.remove('ok', 'mal');
  $('codigo').classList.remove('ok', 'mal');
  pintarMenu();

  $('modalProcesando').hidden = true;
  $('modalTexto').textContent = 'Procesando pago de forma segura...';
  $('modalTexto').classList.remove('listo');
  $('btnPagar').disabled = false;

  $('folioBuscar').value = folio;
  mostrar('estado');
  iniciarRastreo(folio);
});

// ---------- Rastreo (tarda 2 minutos en completarse) ----------
$('formRastreo').addEventListener('submit', e => {
  e.preventDefault();
  iniciarRastreo($('folioBuscar').value.trim().toUpperCase());
});

function iniciarRastreo(folio) {
  clearInterval(rastreoInterval);
  $('msgEstadoError').hidden = true;
  $('infoPedidoBox').hidden = true;

  const pedido = dbPedidos[folio];
  if (!pedido) {
    $('msgEstadoError').textContent = `❌ El pedido ${folio} no existe en el sistema.`;
    $('msgEstadoError').hidden = false;
    return;
  }

  $('infoPedidoBox').hidden = false;
  $('estadoFolio').textContent = folio;
  $('estadoCliente').textContent = pedido.cliente;

  const actualizar = () => {
    const segundos = (Date.now() - pedido.horaCreacion) / 1000;
    const porcentaje = Math.min(100, (segundos / 120) * 100);
    const pasos = document.querySelectorAll('.paso');
    const activos = porcentaje < 33 ? 1 : porcentaje < 66 ? 2 : 3;

    $('barra').style.width = `${porcentaje}%`;
    pasos.forEach((p, i) => p.classList.toggle('activo', i < activos));

    const total = dinero(pedido.total);
    if (porcentaje < 33) $('estadoDetalle').textContent = `Total: ${total} · Estamos preparando la masa y los ingredientes.`;
    else if (porcentaje < 66) $('estadoDetalle').textContent = `Total: ${total} · ¡Tu pizza se está dorando en el horno!`;
    else if (porcentaje < 100) $('estadoDetalle').textContent = `Total: ${total} · ¡Lista! Pasa al mostrador a recogerla.`;
    else {
      $('estadoDetalle').textContent = `¡Orden completada y entregada en mostrador a ${pedido.cliente}!`;
      clearInterval(rastreoInterval);
    }
  };

  actualizar();
  rastreoInterval = setInterval(actualizar, 2000);
}

// ---------- Inicio ----------
$('metodoPago').innerHTML = ['Tarjeta de crédito/débito', 'Efectivo en mostrador', 'Transferencia']
  .map(m => `<option value="${m}">${m}</option>`).join('');
$('heroPizza').innerHTML = pizzaSVG(2);
pintarMenu();
actualizarBarra();