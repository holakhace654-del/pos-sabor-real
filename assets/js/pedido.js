const params = new URLSearchParams(location.search);
const pedidoId = parseInt(params.get('pedido_id'), 10);

let productos = [];
let categorias = [];
let categoriaActiva = null;
let pedido = null;
let productoModal = null;

const catsEl = document.getElementById('cats');
const gridEl = document.getElementById('prod-grid');
const badgesEl = document.getElementById('badges');
const cartItemsEl = document.getElementById('cart-items');
const cartCountEl = document.getElementById('cart-count');
const cartTotalEl = document.getElementById('cart-total');
const backdrop = document.getElementById('modal-backdrop');
const modal = document.getElementById('modifier-modal');

function canalLabel(p) {
  if (p.canal === 'mesa') return p.mesa_nombre || 'Mesa';
  if (p.canal === 'para_llevar') return `Para llevar · ${p.codigo}`;
  return `Domicilio · ${p.codigo}`;
}

function renderBadges() {
  badgesEl.innerHTML = `<div class="pill pill-lg" style="background:var(--accent);color:#fff">${canalLabel(pedido)}</div>`;
}

function renderCats() {
  catsEl.innerHTML = '';
  categorias.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' + (c.id === categoriaActiva ? ' active' : '');
    btn.textContent = c.nombre;
    btn.addEventListener('click', () => { categoriaActiva = c.id; renderCats(); renderGrid(); });
    catsEl.appendChild(btn);
  });
}

function renderGrid() {
  gridEl.innerHTML = '';
  productos.filter(p => p.categoria_id === categoriaActiva).forEach(p => {
    const card = document.createElement('div');
    card.className = 'prod-card';
    card.innerHTML = `
      <div class="ph-photo" ${p.foto_url ? `style="background-image:url('${p.foto_url}')"` : ''}>${p.foto_url ? '' : 'foto: ' + p.nombre}</div>
      <div class="prod-body">
        <div class="prod-name">${p.nombre}</div>
        <div class="prod-price">${formatCOP(p.precio)}</div>
      </div>`;
    card.addEventListener('click', () => onProductClick(p));
    gridEl.appendChild(card);
  });
}

function onProductClick(p) {
  if (p.modificadores && p.modificadores.length) {
    openModifierModal(p);
  } else {
    addItem(p, 1, '', []);
  }
}

function openModifierModal(p) {
  productoModal = p;
  const seleccion = {}; // grupoId -> [opciones]
  let cantidad = 1;

  function opcionSeleccionada(grupo, opcion) {
    return (seleccion[grupo.id] || []).some(o => o.id === opcion.id);
  }

  function toggle(grupo, opcion) {
    const actuales = seleccion[grupo.id] || [];
    if (grupo.tipo === 'unico') {
      seleccion[grupo.id] = [opcion];
    } else if (actuales.some(o => o.id === opcion.id)) {
      seleccion[grupo.id] = actuales.filter(o => o.id !== opcion.id);
    } else {
      seleccion[grupo.id] = [...actuales, opcion];
    }
    draw();
  }

  function extraTotal() {
    return Object.values(seleccion).flat().reduce((s, o) => s + (o.precio_extra || 0), 0);
  }

  function draw() {
    const gruposHtml = p.modificadores.map(g => `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="mod-group-name">${g.nombre}${g.obligatorio ? ' *' : ''}</div>
        ${g.opciones.map(o => `
          <div class="mod-option ${opcionSeleccionada(g, o) ? 'selected' : ''}" data-grupo="${g.id}" data-opcion="${o.id}">
            <div class="mod-check ${g.tipo === 'unico' ? 'radio' : 'checkbox'} ${opcionSeleccionada(g, o) ? 'filled' : ''}"></div>
            <span>${o.nombre}${o.precio_extra ? ' (+' + formatCOP(o.precio_extra) + ')' : ''}</span>
          </div>`).join('')}
      </div>`).join('');

    modal.innerHTML = `
      <div style="font:800 13px 'Manrope',sans-serif">Modificadores · ${p.nombre}</div>
      ${gruposHtml}
      <div class="qty-stepper">
        <div class="qty-btn" id="mod-qty-menos">−</div>
        <div style="font:800 14px 'Manrope',sans-serif;width:24px;text-align:center">${cantidad}</div>
        <div class="qty-btn" id="mod-qty-mas">+</div>
      </div>
      <button class="btn btn-primary" id="mod-agregar">Agregar al pedido · ${formatCOP((p.precio + extraTotal()) * cantidad)}</button>`;

    modal.querySelectorAll('.mod-option').forEach(el => {
      el.addEventListener('click', () => {
        const grupo = p.modificadores.find(g => g.id == el.dataset.grupo);
        const opcion = grupo.opciones.find(o => o.id == el.dataset.opcion);
        toggle(grupo, opcion);
      });
    });
    document.getElementById('mod-qty-menos').addEventListener('click', () => { cantidad = Math.max(1, cantidad - 1); draw(); });
    document.getElementById('mod-qty-mas').addEventListener('click', () => { cantidad += 1; draw(); });
    document.getElementById('mod-agregar').addEventListener('click', () => {
      const obligatoriosOk = p.modificadores.every(g => !g.obligatorio || (seleccion[g.id] || []).length > 0);
      if (!obligatoriosOk) { toast('Selecciona las opciones obligatorias.'); return; }
      const mods = Object.values(seleccion).flat().map(o => ({
        nombre_grupo: p.modificadores.find(g => g.opciones.includes(o))?.nombre || '',
        nombre_opcion: o.nombre,
        precio_extra: o.precio_extra,
      }));
      addItem(p, cantidad, '', mods);
      closeModal();
    });
  }

  draw();
  backdrop.classList.add('open');
}

function closeModal() {
  backdrop.classList.remove('open');
  modal.innerHTML = '';
}
backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

async function addItem(p, cantidad, nota, modificadores) {
  try {
    const res = await Api.post('/api/pedidos.php?action=agregar_item', {
      pedido_id: pedidoId, producto_id: p.id, cantidad, nota, modificadores,
    });
    pedido = res.pedido;
    Sounds.addToCart();
    cartCountEl.classList.remove('bump'); void cartCountEl.offsetWidth; cartCountEl.classList.add('bump');
    renderCart();
  } catch (e) { toast(e.message); }
}

function renderCart() {
  renderBadges();
  cartCountEl.textContent = pedido.items.length;
  cartTotalEl.textContent = formatCOP(pedido.total);
  cartItemsEl.innerHTML = '';
  if (!pedido.items.length) {
    cartItemsEl.innerHTML = '<div class="cart-empty">Aún no has agregado productos</div>';
    return;
  }
  pedido.items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'cart-item pop-in';
    row.innerHTML = `
      <div>
        <div class="cart-item-name">${it.nombre_producto} ${it.comanda_id ? '' : '<span class="pill" style="background:var(--warn-bg);color:var(--warn-text);margin-left:4px">sin enviar</span>'}</div>
        <div class="cart-item-note">${it.nota_completa || ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="qty-btn" data-delta="-1">−</div>
        <div style="font:700 12px 'Manrope',sans-serif;width:14px;text-align:center">${it.cantidad}</div>
        <div class="qty-btn" data-delta="1">+</div>
      </div>`;
    row.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => updateQty(it, parseInt(btn.dataset.delta, 10)));
    });
    cartItemsEl.appendChild(row);
  });

  const sinEnviar = pedido.items.filter(it => !it.comanda_id).length;
  const btnEnviar = document.getElementById('btn-enviar');
  btnEnviar.textContent = sinEnviar ? `Enviar a cocina (${sinEnviar})` : 'Todo enviado a cocina';
  btnEnviar.disabled = sinEnviar === 0;
}

async function updateQty(item, delta) {
  Sounds.tap();
  const nueva = item.cantidad + delta;
  try {
    const res = await Api.post('/api/pedidos.php?action=actualizar_item', { item_id: item.id, cantidad: nueva });
    pedido = res.pedido;
    renderCart();
  } catch (e) { toast(e.message); }
}

document.getElementById('btn-enviar').addEventListener('click', async () => {
  if (!pedido.items.length) { toast('Agrega al menos un producto.'); return; }
  try {
    const res = await Api.post('/api/pedidos.php?action=enviar_cocina', { pedido_id: pedidoId });
    pedido = res.pedido;
    Sounds.newTicket();
    toast('Pedido enviado a cocina');
    renderCart();
  } catch (e) { toast(e.message); }
});

document.getElementById('btn-cobrar').addEventListener('click', () => {
  if (!pedido.items.length) { toast('Agrega al menos un producto antes de cobrar.'); return; }
  window.location.href = `caja.html?pedido_id=${pedidoId}`;
});

document.getElementById('btn-notas').addEventListener('click', async () => {
  const notas = prompt('Notas del pedido', pedido.notas || '');
  if (notas === null) return;
  await Api.post('/api/pedidos.php?action=notas', { pedido_id: pedidoId, notas });
  pedido.notas = notas;
  toast('Notas guardadas');
});

async function init() {
  if (!pedidoId) {
    window.location.href = 'mesas.html';
    return;
  }
  const [, menuRes, catRes, pedRes] = await Promise.all([
    Layout.mount('pedidos'),
    Api.get('/api/productos.php?action=menu'),
    Api.get('/api/categorias.php?action=listar'),
    Api.get(`/api/pedidos.php?action=detalle&id=${pedidoId}`),
  ]);
  productos = menuRes.productos;
  categorias = catRes.categorias;
  pedido = pedRes.pedido;

  if (!pedido) {
    toast('Ese pedido no existe.');
    window.location.href = 'mesas.html';
    return;
  }

  categoriaActiva = categorias[0]?.id ?? null;
  renderCats();
  renderGrid();
  renderCart();
}

init();
