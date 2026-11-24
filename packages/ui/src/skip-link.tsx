"use client";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      onClick={(event) => {
        const content = document.getElementById("main-content");
        if (content) {
          event.preventDefault();
          content.focus();
        }
      }}
    >
      Ir al contenido principal
    </a>
  );
}
