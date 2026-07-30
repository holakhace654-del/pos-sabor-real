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
      <div class="table-seats">${m.puestos}p</div>
    </div>
    <div class="pill pill-${m.estado}">${labelEstado(m.estado)}</div>
    <div class="table-meta">${metaLabel}</div>`;
  el.addEventListener('click', () => abrirMesa(m.id));
  return el;
}

function labelEstado(e) {
  return { libre: 'Libre', ocupada: 'Ocupada', cuenta: 'Cuenta pedida', reservada: 'Reservada' }[e] || e;
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

Layout.mount('mesas').then(() => loadZonas());
