/**
 * Tablero de firma en ventana emergente: se firma con el mouse, el dedo o un lápiz táctil.
 * Resuelve { img, w, h } (PNG con fondo transparente recortado al trazo) o null si se cancela.
 */
export function signaturePad(ctx, { titulo = 'Firma', nombre = '' } = {}) {
  return new Promise((resolve) => {
    let decided = false;
    const done = (v) => { if (!decided) { decided = true; resolve(v); } };

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="sp-hint">${nombre ? `<b></b> · ` : ''}Dibujá la firma dentro del recuadro con el mouse o con el dedo.</p>
      <div class="sp-wrap"><canvas class="sp-canvas" aria-label="Tablero de firma"></canvas><span class="sp-ph"><i class="fas fa-signature"></i> Firmá acá</span><span class="sp-line"></span></div>
      <div class="sp-tools"><button type="button" class="btn btn-ghost btn-sm" data-clear><i class="fas fa-eraser"></i> Limpiar</button><small>Usá “Limpiar” para empezar de nuevo.</small></div>`;
    if (nombre) body.querySelector('.sp-hint b').textContent = nombre;
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    footer.innerHTML = '<button type="button" class="btn btn-ghost" data-c>Cancelar</button><button type="button" class="btn btn-primary" data-ok disabled><i class="fas fa-check"></i> Aplicar firma</button>';

    const canvas = body.querySelector('canvas'), wrap = body.querySelector('.sp-wrap'), ph = body.querySelector('.sp-ph');
    const btnOk = footer.querySelector('[data-ok]');
    const c2 = canvas.getContext('2d');
    let drawing = false, last = null, ink = false, box = null, dpr = 1;

    const fit = () => {
      if (ink) return;
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      c2.lineCap = 'round'; c2.lineJoin = 'round'; c2.strokeStyle = '#0b1f4a'; c2.lineWidth = 2.6 * dpr;
    };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; };
    const grow = (p) => { const m = c2.lineWidth; box = box ? { x0: Math.min(box.x0, p.x - m), y0: Math.min(box.y0, p.y - m), x1: Math.max(box.x1, p.x + m), y1: Math.max(box.y1, p.y + m) } : { x0: p.x - m, y0: p.y - m, x1: p.x + m, y1: p.y + m }; };
    const mark = () => { if (!ink) { ink = true; ph.hidden = true; btnOk.disabled = false; } };

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
      drawing = true; const p = pos(e); last = p; mark(); grow(p);
      c2.beginPath(); c2.arc(p.x, p.y, c2.lineWidth / 2, 0, Math.PI * 2); c2.fillStyle = '#0b1f4a'; c2.fill();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) {
        const p = pos(ev), mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        c2.beginPath(); c2.moveTo(last.x, last.y); c2.quadraticCurveTo(last.x, last.y, mid.x, mid.y); c2.stroke();
        grow(p); last = p;
      }
    });
    const end = (e) => { if (!drawing) return; drawing = false; try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* nada */ } };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') end(e); });

    body.querySelector('[data-clear]').onclick = () => { c2.clearRect(0, 0, canvas.width, canvas.height); ink = false; box = null; ph.hidden = false; btnOk.disabled = true; };

    const exportar = () => {
      const pad = 6 * dpr;
      const x = Math.max(0, Math.floor(box.x0 - pad)), y = Math.max(0, Math.floor(box.y0 - pad));
      const w = Math.min(canvas.width - x, Math.ceil(box.x1 - box.x0 + pad * 2)), h = Math.min(canvas.height - y, Math.ceil(box.y1 - box.y0 + pad * 2));
      const k = Math.min(1, 460 / w), ow = Math.max(1, Math.round(w * k)), oh = Math.max(1, Math.round(h * k));
      const out = document.createElement('canvas'); out.width = ow; out.height = oh;
      out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, ow, oh);
      return { img: out.toDataURL('image/png'), w: ow, h: oh };
    };

    // Esc cierra solo el tablero (no la ventana del recibo que está debajo).
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); m.close(); } };
    window.addEventListener('keydown', onEsc, true);
    const m = ctx.openModal({ title: titulo, body, footer, size: 'md', icon: 'fa-signature', onClose: () => { window.removeEventListener('keydown', onEsc, true); done(null); } });
    footer.querySelector('[data-c]').onclick = () => m.close();
    btnOk.onclick = () => { if (!ink || !box) return; done(exportar()); m.close(); };
    setTimeout(fit, 80); window.addEventListener('resize', fit, { once: false });
    const stop = setInterval(() => { if (!document.body.contains(m.el)) { clearInterval(stop); window.removeEventListener('resize', fit); } }, 500);
  });
}
