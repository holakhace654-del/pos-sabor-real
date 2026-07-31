async function loadZonas() {
  const res = await Api.get('/api/mesas.php?action=listar');
  const cont = document.getElementById('zonas');
  cont.innerHTML = '';

  document.getElementById('qc-para-llevar').textContent = `${res.resumen.para_llevar_activos} pedidos activos`;
  document.getElementById('qc-domicilios').textContent = `${res.resumen.domicilios_activos} en curso`;

  res.zonas.forEach(zona => {
    const title = document.createElement('div');
    title.className = 'zone-title';
    title.textContent = zona.nombre;
    cont.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'tables-grid';
    zona.mesas.forEach(m => grid.appendChild(renderTable(m)));
    cont.appendChild(grid);
  });
}

const ESTADOS_MESA = ['libre', 'ocupada', 'cuenta', 'reservada'];

function renderTable(m) {
  const el = document.createElement('div');
  el.className = `table-card status-${m.estado}`;
  const metaLabel = m.estado === 'ocupada' && m.minutos != null ? `Hace ${m.minutos} min`
    : m.estado === 'cuenta' ? 'Cuenta pedida'
    : m.estado === 'reservada' ? 'Reservada'
    : 'Disponible';
  el.innerHTML = `
    <div class="table-head">
      <div class="table-name">${m.nombre}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="table-seats">${m.puestos}p</div>
        <button type="button" class="table-menu-btn" data-menu-toggle>⋮</button>
      </div>
    </div>
    <div class="pill pill-${m.estado}">${labelEstado(m.estado)}</div>
    <div class="table-meta">${metaLabel}</div>
    <div class="table-menu" data-menu>
      ${ESTADOS_MESA.map(e => `<button type="button" data-set-estado="${e}">Marcar ${labelEstado(e)}</button>`).join('')}
    </div>`;

  el.addEventListener('click', () => abrirMesa(m.id));

  const menuBtn = el.querySelector('[data-menu-toggle]');
  const menu = el.querySelector('[data-menu]');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.table-menu.open').forEach(x => { if (x !== menu) x.classList.remove('open'); });
    menu.classList.toggle('open');
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
  menu.querySelectorAll('[data-set-estado]').forEach(btn => {
    btn.addEventListener('click', () => cambiarEstadoMesa(m.id, btn.dataset.setEstado));
  });

  return el;
}

document.addEventListener('click', () => {
  document.querySelectorAll('.table-menu.open').forEach(x => x.classList.remove('open'));
});

function labelEstado(e) {
  return { libre: 'Libre', ocupada: 'Ocupada', cuenta: 'Cuenta pedida', reservada: 'Reservada' }[e] || e;
}

async function cambiarEstadoMesa(mesaId, estado) {
  Sounds.tap();
  try {
    await Api.post('/api/mesas.php?action=cambiar_estado', { mesa_id: mesaId, estado });
    loadZonas();
  } catch (e) { toast(e.message); }
}

async function abrirMesa(mesaId) {
  Sounds.tap();
  try {
    const res = await Api.post('/api/mesas.php?action=abrir', { mesa_id: mesaId });
    window.location.href = `pedido.html?pedido_id=${res.pedido_id}`;
  } catch (e) {
    toast(e.message);
  }
}

document.getElementById('btn-para-llevar').addEventListener('click', async () => {
  try {
    const res = await Api.post('/api/mesas.php?action=para_llevar');
    window.location.href = `pedido.html?pedido_id=${res.pedido_id}`;
  } catch (e) { toast(e.message); }
});

document.getElementById('btn-domicilio').addEventListener('click', () => {
  window.location.href = 'domicilio.html?nuevo=1';
});

Promise.all([Layout.mount('mesas'), loadZonas()]);
