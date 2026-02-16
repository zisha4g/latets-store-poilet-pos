export const prefetchRoute = (path) => {
  if (typeof document === 'undefined' || !path) return;

  const href = path.startsWith('/') ? path : `/${path}`;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'document';
  link.href = href;

  link.onload = () => link.remove();
  link.onerror = () => link.remove();

  document.head.appendChild(link);
};
