const CANALES = [{ key: null, label: 'Todos' }, { key: 'mesa', label: 'Local' }, { key: 'para_llevar', label: 'Para llevar' }, { key: 'domicilio', label: 'Domicilio' }];
let canalActivo = null;

function renderCanalPills() {
  document.getElementById('canal-pills').innerHTML = CANALES.map(c => `
    <div class="pill" data-canal="${c.key ?? ''}" style="cursor:pointer;padding:9px 14px;background:${canalActivo === c.key ? 'var(--accent)' : 'var(--ghost-bg)'};color:${canalActivo === c.key ? '#fff' : 'var(--ghost-text)'}">${c.label}</div>
  `).join('');
  document.querySelectorAll('[data-canal]').forEach(el => el.addEventListener('click', () => {
    canalActivo = el.dataset.canal === '' ? null : el.dataset.canal;
    renderCanalPills();
    cargar();
  }));
}

async function cargar() {
  const fecha = document.getElementById('f-fecha').value;
  let url = `/api/reportes.php?action=resumen&fecha=${fecha}`;
  if (canalActivo) url += `&canal=${canalActivo}`;
  const res = await Api.get(url);

  document.getElementById('kpis').innerHTML = res.kpis.map(k => `
    <div class="kpi-card"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join('');

  document.getElementById('bars').innerHTML = res.sales_bars.map(b => `<div class="bar" style="height:${b.pct}%" title="${b.hora}:00 · ${formatCOP(b.total)}"></div>`).join('');

  document.getElementById('top-productos').innerHTML = res.top_productos.length
    ? res.top_productos.map(t => `<div class="top-row"><span>${t.nombre_producto}</span><span style="color:var(--text-dim)">${t.cant}</span></div>`).join('')
    : '<div class="cart-empty">Sin ventas registradas</div>';

  document.getElementById('staff').innerHTML = res.staff.length
    ? res.staff.map(s => `<div class="staff-row"><span>${s.name} <span class="pill">${s.role}</span></span><span style="color:var(--text-dim)">${s.metric}</span><span>${s.total}</span></div>`).join('')
    : '<div class="cart-empty">Sin datos para la fecha seleccionada</div>';

  const t = res.turno;
  document.getElementById('cierre-caja').innerHTML = `
    <div style="font:700 12.5px 'Manrope',sans-serif">Cierre de caja</div>
    ${t ? `
      <div class="top-row"><span>Estado</span><span>${t.estado === 'abierto' ? 'Turno abierto' : 'Cerrado'}</span></div>
      <div class="top-row"><span>Base inicial</span><span>${formatCOP(t.base_inicial)}</span></div>
      ${t.estado === 'cerrado' ? `
        <div class="top-row"><span>Esperado</span><span>${formatCOP(t.efectivo_esperado)}</span></div>
        <div class="top-row"><span>Contado</span><span>${formatCOP(t.efectivo_contado)}</span></div>
        <div class="top-row" style="color:${t.diferencia < 0 ? 'var(--danger-text)' : 'var(--ok-text)'}"><span>Diferencia</span><span>${formatCOP(t.diferencia)}</span></div>
      ` : '<div class="cart-empty">Cierra la caja para ver el arqueo.</div>'}
    ` : '<div class="cart-empty">Sin turnos registrados.</div>'}
  `;
}

document.getElementById('f-fecha').addEventListener('change', cargar);

async function init() {
  document.getElementById('f-fecha').value = new Date().toISOString().slice(0, 10);
  renderCanalPills();
  await Promise.all([Layout.mount('reportes'), cargar()]);
}
init();
