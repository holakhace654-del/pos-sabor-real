const DENOMS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
const content = document.getElementById('content');
const pedidoId = new URLSearchParams(location.search).get('pedido_id');

let metodo = 'efectivo';
let billesSeleccionados = {}; // valor -> cantidad de veces tocado
let pedido = null;

function renderTurnoHome(turno) {
  content.innerHTML = `
    <div class="main" style="flex:1">
      <div class="main-header"><div class="main-title">Caja</div></div>
      <div class="card turno-card">
        ${turno ? `
          <div style="font:800 15px 'Manrope',sans-serif">Turno abierto</div>
          <div style="font:600 12px 'Manrope',sans-serif;color:var(--text-dim)">Abierto por ${turno.usuario_nombre} · base ${formatCOP(turno.base_inicial)}</div>
          <div style="font:600 12px 'Manrope',sans-serif;color:var(--text-dim)">Para cobrar un pedido, ábrelo desde el Salón o Domicilios y usa "Cobrar".</div>
          <input class="input" id="f-contado" placeholder="Efectivo contado al cierre">
          <button class="btn btn-primary" id="btn-cerrar">Cerrar caja con arqueo</button>
        ` : `
          <div style="font:800 15px 'Manrope',sans-serif">Abrir caja</div>
          <div style="font:600 12px 'Manrope',sans-serif;color:var(--text-dim)">Ingresa la base inicial de efectivo para comenzar el turno.</div>
          <input class="input" id="f-base" placeholder="Base inicial (ej: 100000)">
          <button class="btn btn-primary" id="btn-abrir">Abrir turno</button>
        `}
      </div>
    </div>`;

  if (turno) {
    document.getElementById('btn-cerrar').addEventListener('click', async () => {
      const contado = parseInt(document.getElementById('f-contado').value, 10) || 0;
      try {
        const res = await Api.post('/api/caja.php?action=cerrar_turno', { efectivo_contado: contado });
        toast(`Caja cerrada. Diferencia: ${formatCOP(res.diferencia)}`);
        Sounds.saleComplete();
        cargarInicio();
      } catch (e) { toast(e.message); }
    });
  } else {
    document.getElementById('btn-abrir').addEventListener('click', async () => {
      const base = parseInt(document.getElementById('f-base').value, 10) || 0;
      try {
        await Api.post('/api/caja.php?action=abrir_turno', { base_inicial: base });
        toast('Caja abierta');
        cargarInicio();
      } catch (e) { toast(e.message); }
    });
  }
}

function totalRecibido() {
  return Object.entries(billesSeleccionados).reduce((s, [valor, veces]) => s + Number(valor) * veces, 0);
}

function renderCobro() {
  const total = pedido.total;
  content.innerHTML = `
    <div class="caja-shell" style="flex:1">
      <div class="cuenta-panel">
        <div style="font:800 16px 'Manrope',sans-serif">Cuenta · ${pedido.canal === 'mesa' ? pedido.mesa_nombre : pedido.codigo}</div>
        <div id="lineas"></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <div style="font:800 14px 'Manrope',sans-serif">Total</div>
          <div style="font:800 16px 'Manrope',sans-serif">${formatCOP(total)}</div>
        </div>
        <div class="split-btns">
          <button class="btn btn-ghost" id="split-persona">Por persona</button>
          <button class="btn btn-ghost" id="split-item">Por ítem</button>
          <button class="btn btn-ghost" id="split-pct">Por %</button>
        </div>
        <div id="split-result" style="font:600 12px 'Manrope',sans-serif;color:var(--text-dim)"></div>
      </div>
      <div class="pay-panel">
        <div style="font:800 14px 'Manrope',sans-serif">Método de pago</div>
        <div class="method-tabs">
          <div class="method-tab ${metodo === 'efectivo' ? 'active' : ''}" data-m="efectivo">Efectivo</div>
          <div class="method-tab ${metodo === 'tarjeta' ? 'active' : ''}" data-m="tarjeta">Tarjeta</div>
          <div class="method-tab ${metodo === 'transferencia' ? 'active' : ''}" data-m="transferencia">Transferencia</div>
        </div>
        <div id="bills-section"></div>
        <div class="recibido-row"><span style="color:var(--text-dim);font-weight:600">Recibido</span><span id="recibido-val">$0</span></div>
        <div class="cambio-box" style="background:var(--ok-bg)">
          <div class="cambio-label" style="color:var(--ok-text)">CAMBIO A DEVOLVER</div>
          <div class="cambio-value" style="color:var(--ok-text)" id="cambio-val">$0</div>
        </div>
        <button class="btn btn-primary btn-block" id="btn-confirmar" disabled>Confirmar cobro</button>
        <div style="font:500 10.5px 'Manrope',sans-serif;color:var(--text-dim);text-align:center">El botón de confirmar solo se activa cuando lo recibido cubre el total</div>
      </div>
    </div>`;

  document.getElementById('lineas').innerHTML = pedido.items.map(it => `
    <div class="linea-item">
      <div class="ph-photo">foto</div>
      <div style="flex:1"><div style="font:700 12.5px 'Manrope',sans-serif">${it.cantidad}&times; ${it.nombre_producto}</div>
      <div style="font:500 10.5px 'Manrope',sans-serif;color:var(--text-dim)">${it.nota || ''}</div></div>
      <div style="font:700 12.5px 'Manrope',sans-serif">${formatCOP(it.subtotal)}</div>
    </div>`).join('');

  document.querySelectorAll('.method-tab').forEach(el => el.addEventListener('click', () => {
    metodo = el.dataset.m;
    renderCobro();
  }));

  ['split-persona', 'split-item', 'split-pct'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => splitInfo(id));
  });

  renderBills(total);
  actualizarPago(total);

  document.getElementById('btn-confirmar').addEventListener('click', () => confirmarCobro(total));
}

function splitInfo(which) {
  const el = document.getElementById('split-result');
  if (which === 'split-persona') {
    const n = parseInt(prompt('¿Entre cuántas personas se divide la cuenta?', '2'), 10) || 1;
    el.textContent = `${formatCOP(Math.ceil(pedido.total / n))} por persona (${n} personas)`;
  } else if (which === 'split-item') {
    el.textContent = 'Cada quien paga lo que consumió: revisa el detalle de la izquierda.';
  } else {
    const pct = parseInt(prompt('¿Qué porcentaje paga esta persona?', '50'), 10) || 100;
    el.textContent = `${formatCOP(Math.ceil(pedido.total * pct / 100))} (${pct}% del total)`;
  }
}

function renderBills(total) {
  const section = document.getElementById('bills-section');
  if (metodo !== 'efectivo') {
    section.innerHTML = `<div style="font:600 12px 'Manrope',sans-serif;color:var(--text-dim)">Pago con ${metodo}: se registra por el total exacto (${formatCOP(total)}).</div>`;
    return;
  }
  section.innerHTML = `
    <div style="font:700 12px 'Manrope',sans-serif">Toca los billetes que entregó el cliente</div>
    <div class="bills-grid" id="bills-grid"></div>`;
  const grid = document.getElementById('bills-grid');
  DENOMS.forEach(v => {
    const times = billesSeleccionados[v] || 0;
    const b = document.createElement('div');
    b.className = 'bill' + (times > 0 ? ' selected' : '');
    b.innerHTML = `<div class="bill-label" style="color:${times > 0 ? '#fff' : 'var(--accent-soft-tx)'}">${formatCOP(v)}${times > 1 ? ' ×' + times : ''}</div>`;
    b.addEventListener('click', () => {
      billesSeleccionados[v] = (billesSeleccionados[v] || 0) + 1;
      Sounds.tap();
      renderBills(total);
      actualizarPago(total);
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (billesSeleccionados[v]) { billesSeleccionados[v]--; renderBills(total); actualizarPago(total); }
    });
    grid.appendChild(b);
  });
  const exact = document.createElement('div');
  exact.className = 'bill-exact';
  exact.textContent = 'Monto exacto';
  exact.addEventListener('click', () => {
    billesSeleccionados = {};
    billesSeleccionados['exact_' + total] = 1; // marcador especial
    actualizarPagoExacto(total);
  });
  grid.appendChild(exact);
}

function actualizarPagoExacto(total) {
  document.getElementById('recibido-val').textContent = formatCOP(total);
  document.getElementById('cambio-val').textContent = formatCOP(0);
  document.getElementById('btn-confirmar').disabled = false;
  document.getElementById('btn-confirmar').dataset.recibido = total;
}

function actualizarPago(total) {
  if (metodo !== 'efectivo') {
    document.getElementById('recibido-val').textContent = formatCOP(total);
    document.getElementById('cambio-val').textContent = formatCOP(0);
    document.getElementById('btn-confirmar').disabled = false;
    document.getElementById('btn-confirmar').dataset.recibido = total;
    return;
  }
  const recibido = totalRecibido();
  const cambio = Math.max(0, recibido - total);
  document.getElementById('recibido-val').textContent = formatCOP(recibido);
  document.getElementById('cambio-val').textContent = formatCOP(cambio);
  const btn = document.getElementById('btn-confirmar');
  btn.disabled = recibido < total;
  btn.dataset.recibido = recibido;
}

async function confirmarCobro(total) {
  const recibido = parseInt(document.getElementById('btn-confirmar').dataset.recibido, 10) || total;
  try {
    const res = await Api.post('/api/caja.php?action=cobrar', { pedido_id: pedidoId, metodo_pago: metodo, recibido });
    Sounds.saleComplete();
    mostrarConfirmacion(res.total, pedido);
  } catch (e) { toast(e.message); }
}

function mostrarConfirmacion(total, ped) {
  content.innerHTML = `
    <div class="main" style="flex:1;align-items:center;justify-content:center">
      <div class="card pop-in" style="width:340px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:14px">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--ok-bg);display:flex;align-items:center;justify-content:center">
          <div style="width:36px;height:20px;border-left:5px solid var(--ok-text);border-bottom:5px solid var(--ok-text);transform:rotate(-45deg) translateY(-3px)"></div>
        </div>
        <div style="font:800 15px 'Manrope',sans-serif">Venta completada</div>
        <div style="font:700 13px 'Manrope',sans-serif;color:var(--text-dim)">${formatCOP(total)} · ${ped.canal === 'mesa' ? ped.mesa_nombre : ped.codigo}</div>
        <button class="btn btn-primary btn-block" onclick="location.href='mesas.html'">Volver al salón</button>
      </div>
    </div>`;
}

async function cargarInicio() {
  const res = await Api.get('/api/caja.php?action=turno');
  renderTurnoHome(res.turno);
}

async function init() {
  await Layout.mount('caja');
  if (pedidoId) {
    const res = await Api.get(`/api/pedidos.php?action=detalle&id=${pedidoId}`);
    pedido = res.pedido;
    renderCobro();
  } else {
    cargarInicio();
  }
}

init();
