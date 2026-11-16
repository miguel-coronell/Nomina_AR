/** Impresión del navegador: clona el contenido en #print-root, que el CSS de impresión aísla. */
export function printHTML(markup, { landscape = false, mixed = false } = {}) {
  const root = document.createElement('div');
  root.id = 'print-root';
  root.innerHTML = (landscape ? '<style>@page { size: A4 landscape; margin: 8mm; }</style>' : '') + (mixed ? '<style>@page clasico { size: A4 landscape; margin: 8mm; } @page completo { size: A4 portrait; margin: 10mm; }</style>' : '') + markup;
  document.body.appendChild(root);
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(() => { if (document.body.contains(root)) cleanup(); }, 2000);
}
