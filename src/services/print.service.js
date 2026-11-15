/** Impresión del navegador: clona el contenido en #print-root, que el CSS de impresión aísla. */
export function printHTML(markup) {
  const root = document.createElement('div');
  root.id = 'print-root';
  root.innerHTML = markup;
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
