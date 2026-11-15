/**
 * Procesa el logo subido: lo reduce a un tamaño razonable y lo devuelve como data URL
 * (para guardarlo en la configuración y usarlo en pantalla, impresión y PDF).
 * Solo corre en el navegador (usa canvas).
 */
export async function fileToLogo(file, { maxW = 480, maxH = 200 } = {}) {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw Object.assign(new Error('Formato no admitido'), { code: 'FORMAT' });
  if (file.size > 5 * 1024 * 1024) throw Object.assign(new Error('El archivo supera los 5 MB'), { code: 'SIZE' });
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Object.assign(new Error('No se pudo leer la imagen'), { code: 'READ' })); i.src = url; });
    const k = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const draw = (bg) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
      x.drawImage(img, 0, 0, w, h);
      return c;
    };
    let data = draw().toDataURL('image/png'), fmt = 'PNG';
    if (data.length > 150_000) { data = draw('#ffffff').toDataURL('image/jpeg', 0.88); fmt = 'JPEG'; }
    if (data.length > 400_000) throw Object.assign(new Error('La imagen es demasiado pesada'), { code: 'SIZE' });
    return { data, w, h, fmt };
  } finally { URL.revokeObjectURL(url); }
}
