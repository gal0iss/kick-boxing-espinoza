"use strict";

const navigationItems = [
  ["index.html#inicio", "Inicio"],
  ["academia.html", "Academia"],
  ["entrenamientos.html", "Entrenamientos"],
  ["horarios.html", "Horarios y planes"],
  ["tienda.html", "Tienda"],
  ["contacto.html", "Contacto"]
];

class KbeHeader extends HTMLElement {
  connectedCallback() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const links = navigationItems
      .map(([href, label]) => {
        const targetPage = href.split("#")[0];
        const current = targetPage === currentPage ? ' aria-current="page"' : "";
        const cta = label === "Contacto" ? " class=\"nav-cta\"" : "";
        return `<a${cta} href="${href}"${current}>${label}</a>`;
      })
      .join("");

    this.outerHTML = `
      <header class="site-header">
        <div class="container nav-wrap">
          <a class="brand" href="index.html#inicio" aria-label="KBE, inicio">
            <img class="brand-logo" src="assets/images/kbe.png" alt="">
            <span class="brand-copy"><strong>KICKBOXING</strong><small>ESPINOZA</small></span>
          </a>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">
            <span></span><span></span><span></span>
          </button>
          <nav id="main-nav" class="main-nav" aria-label="Navegación principal">
            ${links}
          </nav>
        </div>
      </header>`;
  }
}

class KbeFooter extends HTMLElement {
  connectedCallback() {
    this.outerHTML = `
      <footer class="site-footer">
        <div class="container footer-inner">
          <a class="brand footer-brand" href="index.html#inicio" aria-label="KBE, volver al inicio">
            <img class="brand-logo" src="assets/images/kbe.png" alt="">
            <span class="brand-copy"><strong>KICKBOXING</strong><small>ESPINOZA</small></span>
          </a>
          <p>Disciplina. Técnica. Constancia.</p>
          <a href="index.html#inicio" class="back-top">Volver al inicio ↑</a>
        </div>
        <div class="container footer-bottom">
          <span>© <span id="year">${new Date().getFullYear()}</span> KBE · Kickboxing Espinoza</span>
          <span>San Miguel, Santiago de Chile</span>
          <nav class="footer-nav" aria-label="Enlaces del pie de página">
            <a href="academia.html">Academia</a>
            <a href="entrenamientos.html">Entrenamientos</a>
            <a href="horarios.html">Horarios y planes</a>
            <a href="tienda.html">Tienda</a>
            <a href="index.html#ubicacion">Ubicación</a>
            <a href="contacto.html">Contacto</a>
          </nav>
          <div class="footer-social">
            <a href="https://www.instagram.com/kickboxing_kbe/" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://wa.me/56951349496" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </footer>`;
  }
}

class KbeWhatsapp extends HTMLElement {
  connectedCallback() {
    this.outerHTML = `
      <a class="whatsapp-float" href="https://wa.me/56951349496?text=Hola%2C%20quisiera%20consultar%20por%20las%20clases%20de%20KBE." target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp" title="Consultar por WhatsApp">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.52 3.48A11.8 11.8 0 0 0 12.1 0C5.55 0 .21 5.33.21 11.9c0 2.1.55 4.16 1.6 5.97L.1 24l6.28-1.65a11.9 11.9 0 0 0 5.7 1.45h.01c6.56 0 11.9-5.34 11.9-11.9a11.8 11.8 0 0 0-3.47-8.42ZM12.1 21.8a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.73.98.99-3.64-.24-.38a9.85 9.85 0 0 1-1.52-5.27C2.19 6.46 6.56 2.1 12.1 2.1c2.63 0 5.1 1.02 6.96 2.88a9.77 9.77 0 0 1 2.88 6.96c0 5.53-4.5 9.86-9.84 9.86Zm5.4-7.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.68-2.1-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.48.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
        </svg>
      </a>`;
  }
}

customElements.define("kbe-header", KbeHeader);
customElements.define("kbe-footer", KbeFooter);
customElements.define("kbe-whatsapp", KbeWhatsapp);
