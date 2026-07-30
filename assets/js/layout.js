/**
 * Sidebar y guardia de sesión compartidos por todas las pantallas
 * autenticadas. Cada página incluye:
 *   <div id="sidebar-root"></div>
 * y llama a Layout.mount('mesas') indicando su propio módulo activo.
 */
const MODULOS = [
  { key: 'mesas',      label: 'Salón',        href: 'mesas.html' },
  { key: 'pedidos',    label: 'Pedidos',      href: 'pedido.html' },
  { key: 'domicilios', label: 'Domicilios',   href: 'domicilio.html' },
  { key: 'cocina',     label: 'Cocina',       href: 'cocina.html', modulo: 'pedidos' },
  { key: 'caja',       label: 'Caja',         href: 'caja.html' },
  { key: 'menu',       label: 'Menú',         href: 'menu.html' },
  { key: 'inventario', label: 'Inventario',   href: 'inventario.html' },
  { key: 'reportes',   label: 'Reportes',     href: 'reportes.html' },
  { key: 'usuarios',   label: 'Usuarios',     href: 'usuarios.html' },
];

const Layout = {
  user: null,
  permisos: [],

  async mount(activeKey) {
    let me;
    try {
      me = await Api.get('/api/auth.php?action=me');
    } catch {
      window.location.href = 'index.html';
      return null;
    }
    this.user = me.usuario;
    this.permisos = me.permisos;

    const root = document.getElementById('sidebar-root');
    if (root) root.outerHTML = this._render(activeKey);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Api.post('/api/auth.php?action=logout');
        window.location.href = 'index.html';
      });
    }

    return this.user;
  },

  _render(activeKey) {
    const items = MODULOS
      .filter(m => this.permisos.includes(m.modulo || m.key))
      .map(m => `<a class="sidebar-item ${m.key === activeKey ? 'active' : ''}" href="${m.href}"><span class="label">${m.label}</span></a>`)
      .join('');

    return `
      <div class="sidebar">
        <div class="brand">Sabor Real</div>
        ${items}
        <div class="sidebar-footer">
          <span>${this.user.nombre} · ${this.user.rol}</span>
          <a class="sidebar-item" id="btn-logout" style="padding:8px 10px">Cerrar sesión</a>
        </div>
      </div>`;
  },
};
