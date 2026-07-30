let categorias = [];
let productos = [];
let categoriaFiltro = null;
let editando = null; // objeto producto en edición (o {} para nuevo)
let fotoPendiente = null;

const editPanel = document.getElementById('edit-panel');
const fileInput = document.getElementById('file-foto');

function renderCatPills() {
  const pills = [{ id: null, nombre: 'Todas' }, ...categorias];
  document.getElementById('cat-pills').innerHTML = pills.map(c => `
    <div class="pill ${categoriaFiltro === c.id ? '' : ''}" data-cat="${c.id ?? ''}"
      style="cursor:pointer;padding:8px 14px;font:700 11.5px 'Manrope',sans-serif;background:${categoriaFiltro === c.id ? 'var(--accent)' : 'var(--ghost-bg)'};color:${categoriaFiltro === c.id ? '#fff' : 'var(--ghost-text)'}">
      ${c.nombre}</div>`).join('');
  document.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('click', () => {
    categoriaFiltro = el.dataset.cat === '' ? null : parseInt(el.dataset.cat, 10);
    renderCatPills();
    renderRows();
  }));
}

function renderRows() {
  const cont = document.getElementById('menu-rows');
  cont.innerHTML = '';
  productos
    .filter(p => categoriaFiltro === null || p.categoria_id === categoriaFiltro)
    .forEach(p => {
      const row = document.createElement('div');
      row.className = 'menu-row' + (editando && editando.id === p.id ? ' active' : '');
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div class="ph-photo" ${p.foto_url ? `style="background-image:url('${p.foto_url}')"` : ''}>${p.foto_url ? '' : 'foto'}</div>
          <div style="font:700 12.5px 'Manrope',sans-serif">${p.nombre}</div>
        </div>
        <div style="font:700 12px 'Manrope',sans-serif">${formatCOP(p.precio)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="toggle" style="background:${p.disponible ? 'var(--ok-solid)' : 'var(--border)'}" data-toggle="${p.id}">
            <div class="toggle-knob" style="left:${p.disponible ? '16px' : '2px'}"></div>
          </div>
          <span style="font:600 10.5px 'Manrope',sans-serif;color:${p.disponible ? 'var(--ok-text)' : 'var(--text-dim)'}">${p.disponible ? 'Disponible' : 'Agotado'}</span>
        </div>
        <div class="pill">${p.aplica_domicilio ? 'Sí aplica' : 'No aplica'}</div>
        <div style="font:500 11px 'Manrope',sans-serif;color:var(--text-dim)">${(p.modificadores || []).map(g => g.nombre).join(', ') || '—'}</div>`;

      row.querySelector('[data-toggle]').addEventListener('click', async (e) => {
        e.stopPropagation();
        await Api.post('/api/productos.php?action=toggle_disponible', { id: p.id });
        await cargarProductos();
      });
      row.addEventListener('click', () => editarProducto(p));
      cont.appendChild(row);
    });
}

function editarProducto(p) {
  editando = JSON.parse(JSON.stringify(p));
  fotoPendiente = null;
  renderRows();
  renderEditPanel();
}

function nuevoProducto() {
  editando = { id: null, categoria_id: categorias[0]?.id ?? null, nombre: '', descripcion: '', precio: 0, disponible: true, aplica_domicilio: true, modificadores: [] };
  fotoPendiente = null;
  renderRows();
  renderEditPanel();
}

function renderEditPanel() {
  if (!editando) { editPanel.innerHTML = '<div class="cart-empty">Selecciona un producto para editarlo.</div>'; return; }

  editPanel.innerHTML = `
    <div style="font:800 14px 'Manrope',sans-serif">${editando.id ? 'Editar producto' : 'Nuevo producto'}</div>
    <div class="ph-photo edit-photo" id="edit-photo" ${editando.foto_url ? `style="background-image:url('${editando.foto_url}')"` : ''}>
      ${editando.foto_url ? '' : 'foto de producto'}
      <div class="pill" style="position:absolute;bottom:8px;right:8px;background:oklch(23% 0.02 50 / 0.8);color:#fff">Cambiar foto</div>
    </div>
    <input class="input" id="f-nombre" placeholder="Nombre" value="${editando.nombre || ''}">
    <div style="display:flex;gap:8px">
      <input class="input" id="f-precio" placeholder="Precio" type="number" value="${editando.precio || ''}">
      <select class="input" id="f-categoria">
        ${categorias.map(c => `<option value="${c.id}" ${c.id === editando.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
      </select>
    </div>
    <input class="input" id="f-desc" placeholder="Descripción (opcional)" value="${editando.descripcion || ''}">
    <label style="display:flex;align-items:center;gap:8px;font:600 12px 'Manrope',sans-serif"><input type="checkbox" id="f-disponible" ${editando.disponible ? 'checked' : ''}> Disponible</label>
    <label style="display:flex;align-items:center;gap:8px;font:600 12px 'Manrope',sans-serif"><input type="checkbox" id="f-domicilio" ${editando.aplica_domicilio ? 'checked' : ''}> Aplica para domicilio</label>

    <div style="font:700 11px 'Manrope',sans-serif;color:var(--text-dim)">Modificadores</div>
    <div class="mod-editor" id="mod-editor"></div>
    <button class="btn btn-ghost" id="btn-add-grupo">+ Agregar grupo de modificadores</button>

    <button class="btn btn-primary" id="btn-guardar" style="margin-top:6px">Guardar cambios</button>
    ${editando.id ? '<button class="btn btn-ghost" id="btn-eliminar">Eliminar producto</button>' : ''}
  `;

  document.getElementById('edit-photo').addEventListener('click', () => fileInput.click());
  document.getElementById('btn-add-grupo').addEventListener('click', () => {
    editando.modificadores = editando.modificadores || [];
    editando.modificadores.push({ nombre: 'Nuevo grupo', tipo: 'unico', obligatorio: false, opciones: [] });
    renderModEditor();
  });
  document.getElementById('btn-guardar').addEventListener('click', guardarProducto);
  const btnEliminar = document.getElementById('btn-eliminar');
  if (btnEliminar) btnEliminar.addEventListener('click', eliminarProducto);

  renderModEditor();
}

function renderModEditor() {
  const cont = document.getElementById('mod-editor');
  const grupos = editando.modificadores || [];
  cont.innerHTML = grupos.map((g, gi) => `
    <div class="mod-group-editor">
      <div style="display:flex;gap:6px">
        <input class="input" data-g-nombre="${gi}" value="${g.nombre}" style="flex:1">
        <select class="input" data-g-tipo="${gi}" style="width:110px">
          <option value="unico" ${g.tipo === 'unico' ? 'selected' : ''}>Único</option>
          <option value="multiple" ${g.tipo === 'multiple' ? 'selected' : ''}>Múltiple</option>
        </select>
      </div>
      ${(g.opciones || []).map((o, oi) => `
        <div class="mod-opt-row">
          <input class="input" data-o-nombre="${gi}:${oi}" value="${o.nombre}" placeholder="Opción" style="flex:1">
          <input class="input" data-o-precio="${gi}:${oi}" value="${o.precio_extra || 0}" type="number" style="width:80px">
          <span style="cursor:pointer" data-o-del="${gi}:${oi}">✕</span>
        </div>`).join('')}
      <button class="btn btn-ghost" data-add-opt="${gi}" style="padding:6px 10px;font-size:11px">+ opción</button>
      <button class="btn btn-ghost" data-del-grupo="${gi}" style="padding:6px 10px;font-size:11px">Eliminar grupo</button>
    </div>`).join('');

  cont.querySelectorAll('[data-g-nombre]').forEach(el => el.addEventListener('input', () => grupos[el.dataset.gNombre].nombre = el.value));
  cont.querySelectorAll('[data-g-tipo]').forEach(el => el.addEventListener('change', () => grupos[el.dataset.gTipo].tipo = el.value));
  cont.querySelectorAll('[data-o-nombre]').forEach(el => el.addEventListener('input', () => {
    const [gi, oi] = el.dataset.oNombre.split(':');
    grupos[gi].opciones[oi].nombre = el.value;
  }));
  cont.querySelectorAll('[data-o-precio]').forEach(el => el.addEventListener('input', () => {
    const [gi, oi] = el.dataset.oPrecio.split(':');
    grupos[gi].opciones[oi].precio_extra = parseInt(el.value, 10) || 0;
  }));
  cont.querySelectorAll('[data-o-del]').forEach(el => el.addEventListener('click', () => {
    const [gi, oi] = el.dataset.oDel.split(':');
    grupos[gi].opciones.splice(oi, 1);
    renderModEditor();
  }));
  cont.querySelectorAll('[data-add-opt]').forEach(el => el.addEventListener('click', () => {
    grupos[el.dataset.addOpt].opciones = grupos[el.dataset.addOpt].opciones || [];
    grupos[el.dataset.addOpt].opciones.push({ nombre: '', precio_extra: 0 });
    renderModEditor();
  }));
  cont.querySelectorAll('[data-del-grupo]').forEach(el => el.addEventListener('click', () => {
    grupos.splice(el.dataset.delGrupo, 1);
    renderModEditor();
  }));
}

fileInput.addEventListener('change', () => {
  fotoPendiente = fileInput.files[0] || null;
  if (fotoPendiente) {
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('edit-photo').style.backgroundImage = `url('${reader.result}')`; };
    reader.readAsDataURL(fotoPendiente);
  }
});

async function guardarProducto() {
  const payload = {
    id: editando.id,
    categoria_id: parseInt(document.getElementById('f-categoria').value, 10),
    nombre: document.getElementById('f-nombre').value.trim(),
    precio: parseInt(document.getElementById('f-precio').value, 10) || 0,
    descripcion: document.getElementById('f-desc').value.trim(),
    disponible: document.getElementById('f-disponible').checked,
    aplica_domicilio: document.getElementById('f-domicilio').checked,
  };
  try {
    const res = await Api.post('/api/productos.php?action=guardar', payload);
    const id = res.id;

    if (fotoPendiente) {
      const fd = new FormData();
      fd.append('id', id);
      fd.append('foto', fotoPendiente);
      await Api.postForm('/api/productos.php?action=subir_foto', fd);
    }

    await Api.post('/api/productos.php?action=guardar_modificadores', {
      producto_id: id,
      grupos: editando.modificadores || [],
    });

    toast('Producto guardado');
    Sounds.tap();
    editando = null;
    await cargarProductos();
    renderEditPanel();
  } catch (e) { toast(e.message); }
}

async function eliminarProducto() {
  if (!confirm('¿Eliminar este producto?')) return;
  await Api.post('/api/productos.php?action=eliminar', { id: editando.id });
  editando = null;
  await cargarProductos();
  renderEditPanel();
}

document.getElementById('btn-nuevo').addEventListener('click', nuevoProducto);

async function cargarProductos() {
  const res = await Api.get('/api/productos.php?action=listar_admin');
  productos = res.productos;
  renderRows();
}

async function init() {
  const [, catRes] = await Promise.all([
    Layout.mount('menu'),
    Api.get('/api/categorias.php?action=listar'),
    cargarProductos(),
  ]);
  categorias = catRes.categorias;
  renderCatPills();
  renderEditPanel();
}

init();
