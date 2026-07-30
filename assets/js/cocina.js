const ACCENTS = { mesa: 'var(--kitchen-mesa)', para_llevar: 'var(--kitchen-llevar)', domicilio: 'var(--kitchen-domi)' };
const ACTION = {
  pendiente: { label: 'Marcar en preparación', bg: 'var(--kitchen-llevar)' },
  preparacion: { label: 'Marcar listo', bg: 'var(--kitchen-domi)' },
};

let conocidas = new Set();

function renderTicket(c) {
  const accent = ACCENTS[c.canal] || '#fff';
  const itemsHtml = c.items.map(it => `<div class="ticket-item">${it.cantidad}&times; ${it.nombre_producto}</div>`).join('');
  const action = ACTION[c.estado_cocina];

  const el = document.createElement('div');
  el.className = 'ticket pop-in';
  el.innerHTML = `
    <div class="ticket-head">
      <span class="pill" style="background:${accent};color:oklch(15% 0.01 50);font:800 11.5px ui-monospace,monospace;padding:6px 12px">${c.type_label}</span>
      <span style="color:oklch(55% 0.02 60);font:600 10px ui-monospace,monospace">${c.minutos ?? 0} min</span>
    </div>
    <div class="ticket-ref">${c.ref}</div>
    ${itemsHtml}
    ${action
      ? `<button class="ticket-btn" style="background:${action.bg}" data-id="${c.id}">${action.label}</button>`
      : `<div class="ticket-static" style="background:var(--kitchen-domi)">Listo</div>`}
  `;
  const btn = el.querySelector('.ticket-btn');
  if (btn) btn.addEventListener('click', () => avanzar(c.id));
  return el;
}

async function avanzar(pedidoId) {
  Sounds.tap();
  try {
    await Api.post('/api/cocina.php?action=avanzar', { pedido_id: pedidoId });
    cargar(true);
  } catch (e) { toast(e.message); }
}

async function cargar(silencioso = false) {
  let res;
  try {
    res = await Api.get('/api/cocina.php?action=comandas');
  } catch {
    window.location.href = 'index.html';
    return;
  }

  const cols = { pendiente: [], preparacion: [], listo: [] };
  res.comandas.forEach(c => cols[c.estado_cocina]?.push(c));

  const idsActuales = new Set(res.comandas.map(c => c.id));
  const nuevas = [...idsActuales].filter(id => !conocidas.has(id));
  if (!silencioso && conocidas.size && nuevas.length) Sounds.newTicket();
  conocidas = idsActuales;

  for (const key of ['pendiente', 'preparacion', 'listo']) {
    const el = document.getElementById(`col-${key}`);
    el.innerHTML = '';
    if (!cols[key].length) {
      el.innerHTML = '<div class="kds-empty">Sin comandas</div>';
      continue;
    }
    cols[key].forEach(c => el.appendChild(renderTicket(c)));
  }
}

cargar(true);
setInterval(() => cargar(false), 4000);
