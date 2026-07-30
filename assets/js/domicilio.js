const ESTADOS_DOMICILIO = [
  { key: 'recibido', label: 'Recibido' },
  { key: 'preparacion', label: 'En preparación' },
  { key: 'listo_despacho', label: 'Listo despacho' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'entregado', label: 'Entregado' },
];

let zonas = [];
let domiciliarios = [];
let zonaSeleccionada = null;
let domiciliarioSeleccionado = null;
let clienteEncontrado = null;

const modal = document.getElementById('modal-backdrop');
const listEl = document.getElementById('domi-list');

function pillEstado(estado) {
  const map = {
    recibido: 'pill-cuenta', preparacion: 'pill-cuenta', listo_despacho: 'pill-ocupada',
    en_camino: 'pill-libre', entregado: 'pill-reservada',
  };
  return map[estado] || 'pill-reservada';
}

async function loadDomicilios() {
  const res = await Api.get('/api/domicilios.php?action=activos');
  listEl.innerHTML = '';
  if (!res.domicilios.length) {
    listEl.innerHTML = '<div class="cart-empty">No hay domicilios activos.</div>';
    return;
  }
  res.domicilios.forEach(d => listEl.appendChild(renderDomiCard(d)));
}

function renderDomiCard(d) {
  const el = document.createElement('div');
  el.className = 'card domi-card';
  const idx = ESTADOS_DOMICILIO.findIndex(s => s.key === d.estado_domicilio);
  const stepsHtml = ESTADOS_DOMICILIO.map((s, i) => `
    <div class="step">
      <div class="step-dot" style="background:${i <= idx ? 'var(--accent)' : 'var(--ghost-bg)'};color:${i <= idx ? '#fff' : 'var(--text-dim)'}">${i + 1}</div>
      <div class="step-label">${s.label}</div>
    </div>`).join('');

  el.innerHTML = `
    <div class="domi-top">
      <div style="font:800 14px 'Manrope',sans-serif">${d.codigo} · ${d.cliente || 'Sin cliente'}</div>
      <div class="pill ${pillEstado(d.estado_domicilio)}">${ESTADOS_DOMICILIO[idx]?.label || d.estado_domicilio}</div>
    </div>
    <div class="domi-info">${d.direccion || ''} · ${d.telefono || ''} ${d.domiciliario ? '· Domiciliario: ' + d.domiciliario : ''}</div>
    <div class="steps">${stepsHtml}</div>
    <div class="domi-actions">
      <button class="btn btn-ghost" data-open="${d.id}">Ver pedido</button>
      ${idx < ESTADOS_DOMICILIO.length - 1 ? `<button class="btn btn-primary" data-avanzar="${d.id}">Avanzar a "${ESTADOS_DOMICILIO[idx + 1].label}"</button>` : ''}
    </div>`;

  el.querySelector('[data-open]').addEventListener('click', () => location.href = `pedido.html?pedido_id=${d.id}`);
  const avanzarBtn = el.querySelector('[data-avanzar]');
  if (avanzarBtn) avanzarBtn.addEventListener('click', () => avanzarEstado(d.id));
  return el;
}

async function avanzarEstado(pedidoId) {
  Sounds.tap();
  try {
    await Api.post('/api/domicilios.php?action=avanzar_estado', { pedido_id: pedidoId });
    loadDomicilios();
  } catch (e) { toast(e.message); }
}

/* ---------- modal nuevo domicilio ---------- */

function renderZonePills() {
  document.getElementById('zone-pills').innerHTML = zonas.map(z => `
    <div class="zone-pill ${zonaSeleccionada === z.id ? 'selected' : ''}" data-zona="${z.id}">
      <div style="font:700 11px 'Manrope',sans-serif">${z.nombre}</div>
      <div style="font:700 11px 'Manrope',sans-serif">${formatCOP(z.costo)}</div>
    </div>`).join('');
  document.querySelectorAll('.zone-pill').forEach(el => el.addEventListener('click', () => {
    zonaSeleccionada = parseInt(el.dataset.zona, 10);
    renderZonePills();
  }));
}

function renderCouriers() {
  document.getElementById('courier-list').innerHTML = domiciliarios.map(c => `
    <div class="courier-row ${domiciliarioSeleccionado === c.id ? 'selected' : ''}" data-courier="${c.id}" style="width:100%">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="user-avatar" style="width:30px;height:30px;font-size:11px">${c.iniciales}</div>
        <div style="font:700 12px 'Manrope',sans-serif">${c.nombre}</div>
      </div>
      <div class="pill ${c.en_ruta ? 'pill-cuenta' : 'pill-libre'}">${c.estado}</div>
    </div>`).join('');
  document.querySelectorAll('.courier-row').forEach(el => el.addEventListener('click', () => {
    domiciliarioSeleccionado = parseInt(el.dataset.courier, 10);
    renderCouriers();
  }));
}

document.getElementById('btn-nuevo').addEventListener('click', () => openModal());
document.getElementById('btn-cancelar').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

function openModal() {
  clienteEncontrado = null;
  zonaSeleccionada = null;
  domiciliarioSeleccionado = null;
  document.getElementById('f-buscar-tel').value = '';
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-telefono').value = '';
  document.getElementById('f-direccion').value = '';
  document.getElementById('f-referencia').value = '';
  document.getElementById('found-client').style.display = 'none';
  renderZonePills();
  renderCouriers();
  modal.classList.add('open');
}
function closeModal() { modal.classList.remove('open'); }

document.getElementById('btn-buscar').addEventListener('click', async () => {
  const tel = document.getElementById('f-buscar-tel').value.trim();
  if (!tel) return;
  try {
    const res = await Api.get(`/api/clientes.php?action=buscar&telefono=${encodeURIComponent(tel)}`);
    if (res.cliente) {
      clienteEncontrado = res.cliente;
      document.getElementById('f-nombre').value = res.cliente.nombre;
      document.getElementById('f-telefono').value = res.cliente.telefono;
      document.getElementById('f-direccion').value = res.cliente.direccion || '';
      document.getElementById('f-referencia').value = res.cliente.referencia || '';
      zonaSeleccionada = res.cliente.zona_envio_id;
      renderZonePills();
      const fc = document.getElementById('found-client');
      fc.style.display = 'flex';
      fc.innerHTML = `<div style="font:700 12px 'Manrope',sans-serif">Cliente encontrado · ${res.cliente.nombre}</div>
        <div style="font:500 11px 'Manrope',sans-serif;color:var(--text-dim)">${res.cliente.direccion || ''}</div>`;
    } else {
      document.getElementById('f-telefono').value = tel;
      document.getElementById('found-client').style.display = 'none';
      toast('Cliente nuevo: completa sus datos.');
    }
  } catch (e) { toast(e.message); }
});

document.getElementById('btn-crear').addEventListener('click', async () => {
  const nombre = document.getElementById('f-nombre').value.trim();
  const telefono = document.getElementById('f-telefono').value.trim();
  const direccion = document.getElementById('f-direccion').value.trim();
  const referencia = document.getElementById('f-referencia').value.trim();

  if (!nombre || !telefono || !direccion) { toast('Completa nombre, teléfono y dirección.'); return; }

  try {
    const cliRes = await Api.post('/api/clientes.php?action=guardar', {
      nombre, telefono, direccion, referencia, zona_envio_id: zonaSeleccionada,
    });
    const domiRes = await Api.post('/api/domicilios.php?action=crear', {
      cliente_id: cliRes.id, zona_envio_id: zonaSeleccionada, domiciliario_id: domiciliarioSeleccionado,
    });
    Sounds.newTicket();
    window.location.href = `pedido.html?pedido_id=${domiRes.pedido_id}`;
  } catch (e) { toast(e.message); }
});

async function init() {
  const [, zRes, cRes] = await Promise.all([
    Layout.mount('domicilios'),
    Api.get('/api/domicilios.php?action=zonas'),
    Api.get('/api/domicilios.php?action=domiciliarios'),
    loadDomicilios(),
  ]);
  zonas = zRes.zonas;
  domiciliarios = cRes.domiciliarios;

  if (new URLSearchParams(location.search).get('nuevo')) openModal();
  setInterval(loadDomicilios, 8000);
}

init();
