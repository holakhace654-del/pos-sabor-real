let editandoId = null;
const modal = document.getElementById('modal-backdrop');
const MODULO_LABEL = { mesas: 'Mesas', pedidos: 'Pedidos', caja: 'Caja', domicilios: 'Domicilios', menu: 'Menú', inventario: 'Inventario', reportes: 'Reportes' };

async function cargarUsuarios() {
  const res = await Api.get('/api/usuarios.php?action=listar');
  const cont = document.getElementById('usuarios');
  cont.innerHTML = res.usuarios.map(u => `
    <div class="user-row">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="user-avatar" style="width:36px;height:36px;font-size:12px">${u.iniciales}</div>
        <div style="font:700 12.5px 'Manrope',sans-serif">${u.nombre}</div>
      </div>
      <div class="pill">${u.rol}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" data-toggle="${u.id}" style="padding:8px 14px">${u.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="btn btn-ghost" data-edit="${u.id}" style="padding:8px 14px">Editar</button>
      </div>
    </div>`).join('');

  res.usuarios.forEach(u => {
    document.querySelector(`[data-edit="${u.id}"]`).addEventListener('click', () => abrirEdicion(u));
    document.querySelector(`[data-toggle="${u.id}"]`).addEventListener('click', async () => {
      await Api.post('/api/usuarios.php?action=desactivar', { id: u.id });
      cargarUsuarios();
    });
  });
}

function abrirEdicion(u) {
  editandoId = u ? u.id : null;
  document.getElementById('modal-title').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('f-nombre').value = u?.nombre || '';
  document.getElementById('f-iniciales').value = u?.iniciales || '';
  document.getElementById('f-rol').value = u?.rol || 'mesero';
  document.getElementById('f-pin').value = '';
  modal.classList.add('open');
}
document.getElementById('btn-nuevo').addEventListener('click', () => abrirEdicion(null));
document.getElementById('btn-cancelar').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const payload = {
    id: editandoId,
    nombre: document.getElementById('f-nombre').value.trim(),
    iniciales: document.getElementById('f-iniciales').value.trim(),
    rol: document.getElementById('f-rol').value,
    pin: document.getElementById('f-pin').value.trim(),
  };
  try {
    await Api.post('/api/usuarios.php?action=guardar', payload);
    modal.classList.remove('open');
    toast('Usuario guardado');
    cargarUsuarios();
  } catch (e) { toast(e.message); }
});

async function cargarPermisos() {
  const res = await Api.get('/api/usuarios.php?action=permisos');
  const table = document.getElementById('perm-table');
  table.innerHTML = '<div></div>' + res.modulos.map(m => `<div class="perm-head">${MODULO_LABEL[m] || m}</div>`).join('');

  res.roles.forEach(rol => {
    table.innerHTML += `<div style="font:700 12px 'Manrope',sans-serif;text-transform:capitalize">${rol}</div>`;
    res.modulos.forEach(m => {
      const permitido = rol === 'administrador' ? true : !!(res.matrix[rol]?.[m]);
      table.innerHTML += `<div class="perm-check" data-rol="${rol}" data-mod="${m}"
        style="background:${permitido ? 'var(--ok-bg)' : 'var(--ghost-bg)'};color:${permitido ? 'var(--ok-text)' : 'var(--text-dim)'}">${permitido ? '✓' : ''}</div>`;
    });
  });

  table.querySelectorAll('.perm-check').forEach(el => {
    if (el.dataset.rol === 'administrador') { el.style.cursor = 'not-allowed'; return; }
    el.addEventListener('click', async () => {
      const permitido = el.textContent.trim() !== '✓';
      try {
        await Api.post('/api/usuarios.php?action=guardar_permiso', { rol: el.dataset.rol, modulo: el.dataset.mod, permitido });
        cargarPermisos();
      } catch (e) { toast(e.message); }
    });
  });
}

async function init() {
  await Layout.mount('usuarios');
  await cargarUsuarios();
  await cargarPermisos();
}
init();
