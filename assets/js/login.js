let selectedUser = null;
let pin = '';

const grid = document.getElementById('user-grid');
const pinSection = document.getElementById('pin-section');
const pinDotsEl = document.getElementById('pin-dots');
const keypadEl = document.getElementById('keypad');
const subtitle = document.getElementById('subtitle');
const hint = document.getElementById('hint');

function renderPinDots() {
  pinDotsEl.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('div');
    dot.className = 'pin-dot' + (i < pin.length ? ' filled' : '');
    pinDotsEl.appendChild(dot);
  }
}

function renderKeypad() {
  keypadEl.innerHTML = '';
  const keys = ['1','2','3','4','5','6','7','8','9','cambiar','0','borrar'];
  keys.forEach(k => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (k === 'cambiar') {
      btn.className = 'key key-action';
      btn.textContent = 'Cambiar';
      btn.addEventListener('click', () => selectUser(null));
    } else if (k === 'borrar') {
      btn.className = 'key key-action';
      btn.textContent = '⌫';
      btn.addEventListener('click', () => { pin = pin.slice(0, -1); renderPinDots(); Sounds.tap(); });
    } else {
      btn.className = 'key';
      btn.textContent = k;
      btn.addEventListener('click', () => onDigit(k));
    }
    keypadEl.appendChild(btn);
  });
}

async function onDigit(d) {
  if (pin.length >= 4) return;
  Sounds.tap();
  pin += d;
  renderPinDots();
  if (pin.length === 4) {
    await tryLogin();
  }
}

async function tryLogin() {
  try {
    const res = await Api.post('/api/auth.php?action=login', { usuario_id: selectedUser.id, pin });
    Sounds.tap();
    const rol = res.usuario.rol;
    window.location.href = rol === 'domiciliario' ? 'domiciliario.html' : 'mesas.html';
  } catch (e) {
    hint.textContent = e.message;
    pinDotsEl.classList.add('shake');
    Sounds.error();
    setTimeout(() => { pinDotsEl.classList.remove('shake'); pin = ''; renderPinDots(); }, 350);
  }
}

function selectUser(user) {
  selectedUser = user;
  pin = '';
  hint.textContent = '';
  if (!user) {
    pinSection.style.display = 'none';
    subtitle.textContent = 'Selecciona tu usuario';
    [...grid.children].forEach(c => c.classList.remove('selected'));
    return;
  }
  subtitle.textContent = user.nombre;
  pinSection.style.display = 'flex';
  renderPinDots();
  renderKeypad();
}

async function init() {
  try {
    const res = await Api.get('/api/auth.php?action=usuarios');
    grid.innerHTML = '';
    res.usuarios.forEach(u => {
      const card = document.createElement('div');
      card.className = 'user-card';
      card.innerHTML = `
        <div class="user-avatar">${u.iniciales}</div>
        <div class="user-name">${u.nombre}</div>
        <div class="pill">${u.rol}</div>`;
      card.addEventListener('click', () => {
        [...grid.children].forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectUser(u);
      });
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = `<div class="hint">No se pudo cargar la lista de usuarios. Verifica la conexión con la base de datos.</div>`;
  }
}

if (new URLSearchParams(location.search).get('expirado')) {
  hint.textContent = 'Tu sesión expiró, vuelve a ingresar.';
}

init();
