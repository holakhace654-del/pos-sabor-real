let insumos = [];
let editandoId = null;
let movInsumoId = null;
let movTipo = 'entrada';

const modal = document.getElementById('modal-backdrop');
const movModal = document.getElementById('mov-backdrop');

async function cargar() {
  const res = await Api.get('/api/inventario.php?action=listar');
  insumos = res.insumos;

  const alertBar = document.getElementById('alert-bar');
  if (res.bajos.length) {
    alertBar.innerHTML = `<div class="alert-bar">
      <div style="font:700 12.5px 'Manrope',sans-serif;color:var(--danger-text)">${res.bajos.length} insumo(s) con stock bajo — ${res.bajos.map(b => b.nombre).join(', ')}</div>
      <div class="anno" style="background:var(--danger-solid)">sonido: alerta de stock bajo</div>
    </div>`;
    Sounds.lowStock();
  } else {
    alertBar.innerHTML = '';
  }

  const cont = document.getElementById('insumos');
  cont.innerHTML = '';
  insumos.forEach(i => cont.appendChild(renderInsumo(i)));
}

function renderInsumo(i) {
  const el = document.createElement('div');
  el.className = 'insumo-row';
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="font:700 13px 'Manrope',sans-serif">${i.nombre}</div>
      <div style="font:500 10.5px 'Manrope',sans-serif;color:var(--text-dim)">Usado en: ${i.usado_en}</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <div class="insumo-bar-track"><div class="insumo-bar-fill" style="width:${i.pct}%;background:${i.bajo_stock ? 'var(--danger-solid)' : 'var(--ok-solid)'}"></div></div>
      <div style="font:700 12px 'Manrope',sans-serif;width:90px">${i.stock_actual} ${i.unidad}</div>
      <div class="pill ${i.bajo_stock ? 'pill-ocupada' : 'pill-libre'}">${i.bajo_stock ? 'Stock bajo' : 'OK'}</div>
      <button class="btn btn-ghost" data-mov="${i.id}" style="padding:8px 12px">Movimiento</button>
      <button class="btn btn-ghost" data-edit="${i.id}" style="padding:8px 12px">Editar</button>
    </div>`;
  el.querySelector('[data-mov]').addEventListener('click', () => abrirMovimiento(i));
  el.querySelector('[data-edit]').addEventListener('click', () => abrirEdicion(i));
  return el;
}

function abrirEdicion(i) {
  editandoId = i ? i.id : null;
  document.getElementById('modal-title').textContent = i ? 'Editar insumo' : 'Nuevo insumo';
  document.getElementById('f-nombre').value = i?.nombre || '';
  document.getElementById('f-unidad').value = i?.unidad || 'kg';
  document.getElementById('f-stock').value = i?.stock_actual ?? '';
  document.getElementById('f-minimo').value = i?.stock_minimo ?? '';
  document.getElementById('f-meta').value = i?.stock_meta ?? '';
  modal.classList.add('open');
}

document.getElementById('btn-nuevo').addEventListener('click', () => abrirEdicion(null));
document.getElementById('btn-cancelar').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const payload = {
    id: editandoId,
    nombre: document.getElementById('f-nombre').value.trim(),
    unidad: document.getElementById('f-unidad').value.trim() || 'kg',
    stock_actual: parseFloat(document.getElementById('f-stock').value) || 0,
    stock_minimo: parseFloat(document.getElementById('f-minimo').value) || 0,
    stock_meta: parseFloat(document.getElementById('f-meta').value) || 0,
  };
  try {
    await Api.post('/api/inventario.php?action=guardar', payload);
    modal.classList.remove('open');
    toast('Insumo guardado');
    cargar();
  } catch (e) { toast(e.message); }
});

function abrirMovimiento(i) {
  movInsumoId = i.id;
  movTipo = 'entrada';
  document.getElementById('mov-title').textContent = `Movimiento · ${i.nombre}`;
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-motivo').value = '';
  actualizarTipoBtns();
  movModal.classList.add('open');
}

function actualizarTipoBtns() {
  document.querySelectorAll('[data-tipo]').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.tipo === movTipo);
    b.classList.toggle('btn-ghost', b.dataset.tipo !== movTipo);
  });
}
document.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => { movTipo = b.dataset.tipo; actualizarTipoBtns(); }));
document.getElementById('mov-cancelar').addEventListener('click', () => movModal.classList.remove('open'));
movModal.addEventListener('click', e => { if (e.target === movModal) movModal.classList.remove('open'); });

document.getElementById('mov-guardar').addEventListener('click', async () => {
  const cantidad = parseFloat(document.getElementById('mov-cantidad').value) || 0;
  if (cantidad <= 0) { toast('Ingresa una cantidad válida.'); return; }
  try {
    await Api.post('/api/inventario.php?action=movimiento', {
      insumo_id: movInsumoId, tipo: movTipo, cantidad, motivo: document.getElementById('mov-motivo').value.trim(),
    });
    movModal.classList.remove('open');
    toast('Movimiento registrado');
    cargar();
  } catch (e) { toast(e.message); }
});

async function init() {
  await Promise.all([Layout.mount('inventario'), cargar()]);
}
init();
