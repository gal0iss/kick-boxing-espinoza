"use strict";

document.documentElement.classList.add("js");

const WHATSAPP_NUMBER = "56951349496";

const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

initMobileMenu();
initTheme();
initContactForm();
initInterestLinks();
initScrollAnimations();

function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");

  if (!toggle || !nav) return;

  function setMenuOpen(isOpen) {
    nav.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  }

  toggle.addEventListener("click", () => {
    setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !nav.classList.contains("is-open")) return;

    setMenuOpen(false);
    toggle.focus();
  });

  document.addEventListener("click", (event) => {
    if (
      !nav.classList.contains("is-open") ||
      !(event.target instanceof Node) ||
      nav.contains(event.target) ||
      toggle.contains(event.target)
    ) {
      return;
    }

    setMenuOpen(false);
  });
}

function initTheme() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;

  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem("kbe-theme");
  } catch (error) {
    console.warn("No se pudo leer la preferencia de tema guardada.", error);
  }
  const initialTheme = savedTheme === "light" ? "light" : "dark";
  setTheme(initialTheme);

  toggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("kbe-theme", nextTheme);
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema.", error);
    }
  });

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const nextLabel = theme === "light" ? "Modo oscuro" : "Modo claro";
    toggle.setAttribute("aria-label", `Activar ${nextLabel.toLowerCase()}`);
    toggle.querySelector("span").textContent = nextLabel;
  }
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const name = getFormValue(formData, "name");
    const interest = getFormValue(formData, "interest");
    const experience = getFormValue(formData, "experience");
    const goal = getFormValue(formData, "goal");

    if (!name || !interest || !experience) {
      if (status) status.textContent = "Completa los campos obligatorios.";
      return;
    }

    const message = [
      "Hola, KBE. Quisiera consultar por los entrenamientos.",
      "",
      `Nombre: ${name}`,
      `Interés: ${interest}`,
      `Experiencia: ${experience}`,
      ...(goal ? [`Consulta: ${goal}`] : []),
      "",
      "¿Podrían contarme los horarios, valores y disponibilidad actual?"
    ].join("\n");
    const whatsappURL =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    if (status) {
      status.textContent =
        "Se abrirá WhatsApp para que revises y envíes tu consulta.";
    }

    const whatsappWindow = window.open(whatsappURL, "_blank");
    if (!whatsappWindow) {
      window.location.assign(whatsappURL);
      return;
    }

    whatsappWindow.opener = null;
  });
}

function getFormValue(formData, fieldName) {
  return String(formData.get(fieldName) ?? "").trim();
}

function initInterestLinks() {
  const interestSelect = document.getElementById("interest");
  if (!interestSelect) return;

  const requestedInterest = new URLSearchParams(window.location.search).get("interest");
  if (!requestedInterest) return;

  const optionExists = Array.from(interestSelect.options).some(
    (option) => option.value === requestedInterest || option.textContent === requestedInterest
  );
  if (optionExists) interestSelect.value = requestedInterest;
}

function initScrollAnimations() {
  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const sections = document.querySelectorAll(
    "main > section:not(.hero)"
  );
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0.05 }
  );

  document.body.classList.add("motion-ready");
  sections.forEach((section) => observer.observe(section));
}
