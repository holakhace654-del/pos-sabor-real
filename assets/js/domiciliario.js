let conocidos = new Set();

async function cargar(primeraVez = false) {
  let res;
  try {
    res = await Api.get('/api/domicilios.php?action=mis_entregas');
  } catch {
    window.location.href = 'index.html';
    return;
  }
  const cont = document.getElementById('entregas');
  document.getElementById('count-pill').textContent = `${res.entregas.length} activas`;

  const nuevos = res.entregas.filter(d => !conocidos.has(d.id));
  if (!primeraVez && nuevos.length) Sounds.newTicket();
  conocidos = new Set(res.entregas.map(d => d.id));

  cont.innerHTML = '';
  if (!res.entregas.length) {
    cont.innerHTML = '<div class="cart-empty">No tienes entregas asignadas por ahora.</div>';
    return;
  }
  res.entregas.forEach(d => cont.appendChild(renderEntrega(d)));
}

function renderEntrega(d) {
  const el = document.createElement('div');
  el.className = 'card entrega-card pop-in';
  el.innerHTML = `
    <div class="entrega-top">
      <div style="font:800 13px 'Manrope',sans-serif">${d.codigo}</div>
      <div class="pill" style="background:var(--warn-bg);color:var(--warn-text)">${d.estado_domicilio === 'en_camino' ? 'En camino' : 'Listo para recoger'}</div>
    </div>
    <div style="font:700 12.5px 'Manrope',sans-serif">${d.cliente || 'Cliente'}</div>
    <div style="font:500 11.5px 'Manrope',sans-serif;color:var(--text-dim)">${d.direccion || ''}</div>
    <div style="font:500 11.5px 'Manrope',sans-serif;color:var(--text-dim)">${d.telefono || ''}</div>
    <div style="font:700 12px 'Manrope',sans-serif">${formatCOP(d.total)}</div>
    <div class="entrega-actions">
      <a class="btn btn-ghost" style="flex:1;text-align:center;text-decoration:none" href="tel:${d.telefono}">Llamar</a>
      <button class="btn btn-primary" style="flex:1" data-id="${d.id}">Marcar entregado</button>
    </div>`;
  el.querySelector('[data-id]').addEventListener('click', () => marcarEntregado(d.id));
  return el;
}

async function marcarEntregado(pedidoId) {
  if (!confirm('¿Confirmar que el pedido fue entregado y cobrado?')) return;
  try {
    await Api.post('/api/domicilios.php?action=marcar_entregado', { pedido_id: pedidoId });
    Sounds.saleComplete();
    toast('Entrega registrada');
    cargar();
  } catch (e) { toast(e.message); }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await Api.post('/api/auth.php?action=logout');
  window.location.href = 'index.html';
});

cargar(true);
setInterval(() => cargar(false), 6000);
