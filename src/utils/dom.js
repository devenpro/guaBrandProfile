export function icon(name) {
  if (!name) return '';
  if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
  return '<i class="fa-solid fa-' + name + '"></i>';
}
