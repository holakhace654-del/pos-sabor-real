/**
 * Sonidos de la interfaz, sintetizados con Web Audio API.
 * No requiere archivos de audio (útil en hosting compartido sin espacio extra).
 */
const Sounds = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.18, delay = 0, glideTo = null }) {
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + delay + duration);
    g.gain.setValueAtTime(0, c.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + duration);
    osc.connect(g).connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.02);
  }

  return {
    addToCart() {
      tone({ freq: 720, duration: 0.09, type: 'triangle', gain: 0.15 });
    },
    saleComplete() {
      tone({ freq: 660, duration: 0.14, type: 'sine', gain: 0.2 });
      tone({ freq: 880, duration: 0.22, type: 'sine', gain: 0.2, delay: 0.13 });
    },
    newTicket() {
      tone({ freq: 520, duration: 0.16, type: 'square', gain: 0.16 });
      tone({ freq: 780, duration: 0.16, type: 'square', gain: 0.16, delay: 0.14 });
    },
    lowStock() {
      tone({ freq: 300, duration: 0.22, type: 'sawtooth', gain: 0.14, glideTo: 220 });
    },
    tap() {
      tone({ freq: 500, duration: 0.05, type: 'sine', gain: 0.1 });
    },
    error() {
      tone({ freq: 220, duration: 0.18, type: 'square', gain: 0.15 });
    },
  };
})();
