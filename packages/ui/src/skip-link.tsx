export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
    >
      Ir al contenido principal
    </a>
  );
}
