/**
 * Cliente fetch mínimo para la API PHP. Todas las respuestas son JSON
 * con forma { ok: true, ... } o { ok: false, error: "..." }.
 */
const Api = {
  async get(path) {
    return Api._call(path, { method: 'GET' });
  },
  async post(path, data) {
    return Api._call(path, { method: 'POST', body: JSON.stringify(data ?? {}) });
  },
  async postForm(path, formData) {
    return Api._call(path, { method: 'POST', body: formData }, true);
  },
  async _call(path, opts, isForm = false) {
    const headers = isForm ? {} : { 'Content-Type': 'application/json' };
    const res = await fetch(path, { credentials: 'same-origin', headers, ...opts });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Respuesta inválida del servidor.');
    }
    if (!res.ok || data.ok === false) {
      if (res.status === 401) {
        window.location.href = '/index.html?expirado=1';
      }
      throw new Error(data.error || 'Error inesperado.');
    }
    return data;
  },
};

function formatCOP(value) {
  return '$' + Math.round(Number(value) || 0).toLocaleString('es-CO');
}

function toast(message, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
