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
initReservationSystem();
initAdminSystem();
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

function escapeHtml(value) {
  return window.KBEReservationUtils.escapeHtml(value);
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

function initReservationSystem() {
  const form = document.getElementById("reservation-form");
  const classList = document.getElementById("class-list");
  const classListStatus = document.getElementById("class-list-status");
  const classSelect = document.getElementById("reservation-class");
  const status = document.getElementById("reservation-status");
  const submitButton = document.getElementById("reservation-submit");
  const phoneInput = document.getElementById("reservation-phone");
  const sendCodeButton = document.getElementById("reservation-send-code");
  const verifyCodeButton = document.getElementById("reservation-verify-code");
  const codeGroup = document.getElementById("reservation-code-group");
  const codeInput = document.getElementById("reservation-code");

  if (!form || !classList || !classListStatus || !classSelect || !status || !submitButton || !phoneInput || !sendCodeButton || !verifyCodeButton || !codeGroup || !codeInput) return;

  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey || !window.supabase) {
    classListStatus.textContent = "Configura la URL y la clave pública de Supabase para activar la reserva.";
    classSelect.disabled = true;
    submitButton.disabled = true;
    sendCodeButton.disabled = true;
    verifyCodeButton.disabled = true;
    status.textContent = "La reserva queda desactivada hasta configurar Supabase.";
    classList.innerHTML = '<p class="empty-state">Completa la configuración de Supabase para ver las clases disponibles.</p>';
    return;
  }

  const supabase = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  function formatClassDate(dateString) {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateString));
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.dataset.state = type;
  }

  let verifiedPhone = "";

  function resetPhoneVerification() {
    verifiedPhone = "";
    submitButton.disabled = true;
    codeInput.value = "";
    codeGroup.hidden = true;
  }

  async function sendPhoneCode() {
    const phone = window.KBEReservationUtils.getPhoneForAuth(phoneInput.value);
    if (!phone) {
      setStatus("Ingresa un teléfono válido con código de país para recibir el SMS.", "error");
      phoneInput.focus();
      return;
    }

    resetPhoneVerification();
    sendCodeButton.disabled = true;
    setStatus("Enviando código SMS...", "loading");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;

      codeGroup.hidden = false;
      codeInput.focus();
      setStatus("Código enviado. Ingresa el código recibido para verificar el teléfono.", "success");
    } catch (error) {
      console.error("Error sending phone verification code", error);
      setStatus("No se pudo enviar el código. Revisa el número o intenta más tarde.", "error");
    } finally {
      sendCodeButton.disabled = false;
    }
  }

  async function verifyPhoneCode() {
    const phone = window.KBEReservationUtils.getPhoneForAuth(phoneInput.value);
    const token = codeInput.value.trim();
    if (!phone || !/^\d{6,10}$/.test(token)) {
      setStatus("Ingresa un teléfono válido y el código SMS recibido.", "error");
      return;
    }

    verifyCodeButton.disabled = true;
    setStatus("Verificando teléfono...", "loading");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms"
      });
      if (error) throw error;

      const verifiedAccountPhone = window.KBEReservationUtils.getPhoneForAuth(data.user?.phone);
      if (!data.session || !data.user?.phone_confirmed_at || verifiedAccountPhone !== phone) {
        throw new Error("The returned account does not confirm the requested phone.");
      }

      verifiedPhone = phone;
      submitButton.disabled = false;
      setStatus("Teléfono verificado. Ya puedes reservar un cupo.", "success");
    } catch (error) {
      console.error("Error verifying phone code", error);
      setStatus("No se pudo verificar el código. Comprueba el código o solicita otro.", "error");
    } finally {
      verifyCodeButton.disabled = false;
    }
  }

  function renderClassCards(classes) {
    if (!classes.length) {
      classList.innerHTML = '<p class="empty-state">No hay clases publicadas por el momento.</p>';
      classSelect.innerHTML = '<option value="">No hay clases disponibles</option>';
      classSelect.disabled = true;
      return;
    }

    const reservableClasses = classes.filter((item) => Number(item.available_slots ?? 0) > 0);
    classSelect.disabled = reservableClasses.length === 0;
    classSelect.innerHTML = `<option value="">${reservableClasses.length ? "Selecciona una clase" : "No quedan cupos disponibles"}</option>` + reservableClasses
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)} · ${formatClassDate(item.starts_at)}</option>`)
      .join("");

    classList.innerHTML = classes.map((item) => {
      const availableSlots = Number(item.available_slots ?? 0);
      const isFull = availableSlots <= 0;
      return `
        <article class="class-item ${isFull ? "is-full" : ""}">
          <div class="class-item-header">
            <h4>${escapeHtml(item.title)}</h4>
            <span class="class-availability">${isFull ? "Completa" : `${availableSlots} disponibles`}</span>
          </div>
          <p>${formatClassDate(item.starts_at)}</p>
          <div class="class-meta">
            <span>Capacidad: ${Number(item.capacity ?? 0)}</span>
            <span>Cupos: ${availableSlots}</span>
            ${item.ends_at ? `<span>Fin: ${new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }).format(new Date(item.ends_at))}</span>` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  async function refreshClasses() {
    classListStatus.textContent = "Cargando disponibilidad...";
    try {
      const { data, error } = await supabase
        .from("published_classes_public")
        .select("*")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

      if (error) throw error;

      renderClassCards(Array.isArray(data) ? data : []);
      classListStatus.textContent = Array.isArray(data) && data.length ? `${data.length} clase(s) disponible(s)` : "No hay clases publicadas";
    } catch (error) {
      classListStatus.textContent = "No se pudo cargar la disponibilidad actual.";
      classList.innerHTML = '<p class="empty-state">Revisa la configuración de Supabase o intenta nuevamente más tarde.</p>';
      console.error("Error loading classes", error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const selectedClass = classSelect.value;
    const studentName = document.getElementById("reservation-name").value.trim();
    const phone = document.getElementById("reservation-phone").value.trim();
    const email = document.getElementById("reservation-email").value.trim();
    const authPhone = window.KBEReservationUtils.getPhoneForAuth(phone);
    const validationMessage = window.KBEReservationUtils.validateReservationInput({
      classId: selectedClass,
      name: studentName,
      phone,
      email
    });

    if (validationMessage) {
      setStatus(validationMessage, "error");
      return;
    }
    if (!authPhone || verifiedPhone !== authPhone) {
      resetPhoneVerification();
      setStatus("Verifica por SMS que controlas este teléfono antes de reservar.", "error");
      return;
    }

    submitButton.disabled = true;
    setStatus("Reservando tu cupo...", "loading");

    try {
      const { data, error } = await supabase.rpc("book_class", {
        p_class_id: selectedClass,
        p_student_name: studentName,
        p_phone: window.KBEReservationUtils.getPhoneDigits(authPhone),
        p_email: email || null
      });

      if (error) {
        setStatus(window.KBEReservationUtils.getBookingErrorMessage(error), "error");
        return;
      }

      if (data && data.success) {
        setStatus("Cupo confirmado. KBE registró tu reserva.", "success");
        form.reset();
        resetPhoneVerification();
        await refreshClasses();
      } else {
        setStatus("No se pudo confirmar la reserva. Intenta nuevamente.", "error");
      }
    } catch (error) {
      console.error("Error reserving class", error);
      setStatus("Ocurrió un error temporal. Intenta nuevamente en unos momentos.", "error");
    } finally {
      submitButton.disabled = verifiedPhone !== authPhone;
    }
  });

  phoneInput.addEventListener("input", () => {
    resetPhoneVerification();
    setStatus("Verifica tu teléfono por SMS antes de reservar.", "error");
  });
  sendCodeButton.addEventListener("click", sendPhoneCode);
  verifyCodeButton.addEventListener("click", verifyPhoneCode);

  refreshClasses();
}

function getSupabaseConfig() {
  const config = window.KBE_SUPABASE_CONFIG || {};
  return {
    url: String(config.url || window.SUPABASE_URL || "").trim(),
    anonKey: String(config.anonKey || window.SUPABASE_ANON_KEY || "").trim()
  };
}

function initAdminSystem() {
  const loginForm = document.getElementById("admin-login-form");
  const authPanel = document.getElementById("admin-auth");
  const dashboard = document.getElementById("admin-dashboard");
  const logoutButton = document.getElementById("admin-logout");
  const classForm = document.getElementById("class-form");
  const classList = document.getElementById("classes-list");
  const reservationList = document.getElementById("reservation-list");
  const searchInput = document.getElementById("reservation-search");
  const dateFilter = document.getElementById("reservation-date-filter");
  const statusFilter = document.getElementById("reservation-status-filter");
  const statusBox = document.getElementById("admin-login-status");
  const dashboardStatus = document.getElementById("admin-dashboard-status");
  const classStatusBox = document.getElementById("class-form-status");

  if (!loginForm || !authPanel || !dashboard || !logoutButton || !classForm || !classList || !reservationList || !searchInput || !dateFilter || !statusFilter || !statusBox || !dashboardStatus || !classStatusBox) {
    return;
  }

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase) {
    statusBox.textContent = "Configura la URL y la clave pública de Supabase para habilitar el panel del profesor.";
    loginForm.querySelector("button[type='submit']").disabled = true;
    return;
  }

  const supabase = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  const pageSize = 500;

  async function fetchAllRows(queryFactory) {
    return window.KBEReservationUtils.fetchAllPages(
      (offset, limit) => queryFactory().range(offset, offset + limit - 1),
      pageSize
    );
  }

  const state = {
    user: null,
    selectedClassId: null,
    classes: [],
    reservations: []
  };

  function setStatus(element, message, type = "error") {
    element.textContent = message;
    element.dataset.state = type;
  }

  function showAuthView() {
    authPanel.hidden = false;
    dashboard.hidden = true;
    logoutButton.hidden = true;
  }

  function showDashboardView() {
    authPanel.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function formatDateTimeLocal(value) {
    return window.KBEReservationUtils.getDateTimeLocalInTimeZone(value);
  }

  function populateClassForm(classItem) {
    document.getElementById("class-id").value = classItem?.id || "";
    document.getElementById("class-title").value = classItem?.title || "";
    document.getElementById("class-starts").value = classItem ? formatDateTimeLocal(classItem.starts_at) : "";
    document.getElementById("class-ends").value = classItem && classItem.ends_at ? formatDateTimeLocal(classItem.ends_at) : "";
    document.getElementById("class-capacity").value = classItem?.capacity || 25;
    document.getElementById("class-status").value = classItem?.status || "published";
  }

  function resetClassForm() {
    document.getElementById("class-id").value = "";
    classForm.reset();
    state.selectedClassId = null;
    document.getElementById("class-capacity").value = 25;
    document.getElementById("class-status").value = "published";
    setStatus(classStatusBox, "", "success");
  }

  function renderClasses(classes, summaryClasses = classes) {
    state.classes = summaryClasses || [];
    if (!classes.length) {
      classList.innerHTML = '<p class="empty-state">Todavía no hay clases creadas.</p>';
      return;
    }

    classList.innerHTML = classes.map((item) => {
      const { reserved: reservedCount, available } = window.KBEReservationUtils.getClassAvailability(item);
      return `
        <article class="admin-class-item ${item.status === "cancelled" ? "is-cancelled" : ""}">
          <div class="admin-class-head">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${formatDateTime(item.starts_at)}</p>
            </div>
            <span class="admin-badge admin-badge-${item.status}">${item.status}</span>
          </div>
          <div class="admin-class-meta">
            <span>Capacidad: ${item.capacity}</span>
            <span>Reservas: ${reservedCount}</span>
            <span>Disponibles: ${available}</span>
          </div>
          <div class="admin-class-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="button button-dark">Editar</button>
            <button type="button" data-action="publish" data-id="${escapeHtml(item.id)}" class="button button-red" ${item.status === "published" ? "disabled" : ""}>${item.status === "published" ? "Publicada" : "Publicar"}</button>
            <button type="button" data-action="cancel" data-id="${escapeHtml(item.id)}" class="button button-dark" ${item.status === "cancelled" ? "disabled" : ""}>${item.status === "cancelled" ? "Cancelada" : "Cancelar"}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadClasses() {
    const todayStart = window.KBEReservationUtils.dateTimeLocalToISO(
      `${window.KBEReservationUtils.getDateInTimeZone(new Date())}T00:00`
    );
    let data;
    try {
      data = await fetchAllRows(() => supabase
        .from("classes")
        .select("id, title, starts_at, ends_at, capacity, status")
        .gte("starts_at", todayStart)
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true }));
    } catch (error) {
      classList.innerHTML = '<p class="empty-state">No se pudieron cargar las clases.</p>';
      console.error("Error loading admin classes", error);
      setStatus(dashboardStatus, "No se pudieron cargar las clases. Revisa la conexión y tus permisos.", "error");
      return;
    }

    let reservations;
    try {
      reservations = await fetchAllRows(() => supabase
        .from("reservations")
        .select("id, class_id")
        .eq("status", "confirmed")
        .order("class_id", { ascending: true })
        .order("id", { ascending: true }));
    } catch (error) {
      classList.innerHTML = '<p class="empty-state">No se pudo cargar la ocupación de clases.</p>';
      console.error("Error loading reservation counts", error);
      setStatus(dashboardStatus, "No se pudo cargar la ocupación. Revisa tus permisos.", "error");
      return;
    }

    const reservationCounts = (reservations || []).reduce((counts, item) => {
      counts.set(item.class_id, (counts.get(item.class_id) || 0) + 1);
      return counts;
    }, new Map());
    const classes = (data || []).map((item) => {
      const reservedCount = reservationCounts.get(item.id) || 0;
      return { ...item, reserved_count: reservedCount };
    });

    renderClasses(
      classes.filter((item) => new Date(item.starts_at) >= new Date()),
      classes
    );
    updateSummary();
    setStatus(dashboardStatus, "", "success");
    if (!state.selectedClassId) {
      resetClassForm();
    }
  }

  function renderReservations() {
    const filteredReservations = window.KBEReservationUtils.filterReservations(
      state.reservations,
      {
        query: searchInput.value,
        date: dateFilter.value,
        status: statusFilter.value
      }
    );

    if (!filteredReservations.length) {
      reservationList.innerHTML = `<p class="empty-state">${state.reservations.length ? "No hay reservas que coincidan con los filtros." : "No hay reservas registradas."}</p>`;
      return;
    }

    reservationList.innerHTML = filteredReservations.map((reservation) => `
      <article class="admin-reservation-item ${reservation.status === "cancelled" ? "is-cancelled" : ""}">
        <div class="admin-reservation-head">
          <div>
            <h3>${escapeHtml(reservation.student_name)}</h3>
            <p>${escapeHtml(reservation.class_title || "Clase")} · ${formatDateTime(reservation.class_starts_at)}</p>
          </div>
          <span class="admin-badge admin-badge-${reservation.status}">${reservation.status === "confirmed" ? "Confirmada" : "Cancelada"}</span>
        </div>
        <div class="admin-reservation-meta">
          <span>${escapeHtml(reservation.phone)}</span>
          <span>${escapeHtml(reservation.email || "Sin correo")}</span>
          <span>Reserva: ${formatDateTime(reservation.created_at)}</span>
        </div>
        <div class="admin-class-actions">
          <button type="button" data-reservation-action="cancel" data-id="${escapeHtml(reservation.id)}" class="button button-dark" ${reservation.status === "cancelled" ? "disabled" : ""}>Cancelar reserva</button>
        </div>
      </article>
    `).join("");
  }

  function updateSummary() {
    const summary = window.KBEReservationUtils.summarizeToday(
      state.classes,
      state.reservations
    );
    document.getElementById("summary-reservations").textContent = String(summary.reservationCount);
    document.getElementById("summary-classes").textContent = String(summary.classCount);
    document.getElementById("summary-occupancy").textContent = `${summary.occupancyPercent}%`;
    document.getElementById("summary-capacity").textContent =
      `${summary.reservationCount} de ${summary.capacity} cupos ocupados`;
  }

  async function loadReservations() {
    let data;
    try {
      data = await fetchAllRows(() => supabase
        .from("reservations")
        .select("id, class_id, student_name, phone, email, status, created_at, classes(title, starts_at)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }));
    } catch (error) {
      reservationList.innerHTML = '<p class="empty-state">No se pudieron cargar las reservas.</p>';
      console.error("Error loading admin reservations", error);
      setStatus(dashboardStatus, "No se pudieron cargar las reservas. Revisa la conexión y tus permisos.", "error");
      return;
    }

    state.reservations = (data || []).map((reservation) => ({
      ...reservation,
      class_title: reservation.classes?.title || "Clase",
      class_starts_at: reservation.classes?.starts_at || ""
    }));
    renderReservations();
    updateSummary();
    setStatus(dashboardStatus, "", "success");
  }

  async function ensureAdminAccess() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      showAuthView();
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      throw profileError;
    }

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      setStatus(statusBox, "La cuenta no tiene permisos de administrador.", "error");
      showAuthView();
      return false;
    }

    state.user = user;
    showDashboardView();
    return true;
  }

  async function handleClassSubmit(event) {
    event.preventDefault();
    if (!classForm.reportValidity()) return;

    const id = document.getElementById("class-id").value;
    const title = document.getElementById("class-title").value.trim();
    const startsAtLocal = document.getElementById("class-starts").value;
    const endsAtLocal = document.getElementById("class-ends").value;
    const startsAt = window.KBEReservationUtils.dateTimeLocalToISO(startsAtLocal);
    const endsAt = endsAtLocal ? window.KBEReservationUtils.dateTimeLocalToISO(endsAtLocal) : null;
    if (!title || !startsAt || (endsAtLocal && !endsAt) || (endsAt && new Date(endsAt) <= new Date(startsAt))) {
      setStatus(classStatusBox, "Revisa el nombre y las fechas; el fin debe ser posterior al inicio.", "error");
      return;
    }

    const payload = {
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      capacity: Number(document.getElementById("class-capacity").value || 25),
      status: document.getElementById("class-status").value
    };

    try {
      if (id) {
        const { error } = await supabase.from("classes").update(payload).eq("id", id);
        if (error) throw error;
        setStatus(classStatusBox, "Clase actualizada correctamente.", "success");
      } else {
        const { error } = await supabase.from("classes").insert([payload]);
        if (error) throw error;
        setStatus(classStatusBox, "Clase creada correctamente.", "success");
      }
      resetClassForm();
      await loadClasses();
      await loadReservations();
    } catch (error) {
      console.error(error);
      const message = String(error?.message || "");
      setStatus(
        classStatusBox,
        message.includes("CAPACITY_BELOW_CONFIRMED_RESERVATIONS")
          ? window.KBEReservationUtils.getBookingErrorMessage(error)
          : "No se pudo guardar la clase. Revisa los datos o tus permisos.",
        "error"
      );
    }
  }

  async function handleClassAction(action, id) {
    try {
      const current = state.classes.find((item) => item.id === id);
      if (!current) return;

      if (action === "edit") {
        state.selectedClassId = id;
        populateClassForm(current);
        document.getElementById("class-title").focus();
        return;
      }

      const nextStatus = action === "publish" ? "published" : "cancelled";
      if (nextStatus === "cancelled" && !window.confirm(`¿Cancelar la clase "${current.title}"?`)) return;
      const { error } = await supabase.from("classes").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;
      await loadClasses();
      await loadReservations();
    } catch (error) {
      console.error(error);
      setStatus(classStatusBox, "No se pudo actualizar el estado de la clase.", "error");
    }
  }

  async function handleReservationCancel(id) {
    try {
      if (!window.confirm("¿Cancelar esta reserva? El cupo quedará disponible nuevamente.")) return;
      const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      await loadReservations();
      await loadClasses();
    } catch (error) {
      console.error(error);
      setStatus(classStatusBox, "No se pudo cancelar la reserva.", "error");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    try {
      setStatus(statusBox, "Ingresando...", "error");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await ensureAdminAccess();
    } catch (error) {
      console.error(error);
      setStatus(statusBox, "Credenciales inválidas o sin acceso administrativo.", "error");
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showAuthView();
      loginForm.reset();
      setStatus(statusBox, "Sesión cerrada.", "success");
    } catch (error) {
      console.error("Error signing out", error);
      setStatus(dashboardStatus, "No se pudo cerrar la sesión.", "error");
    }
  });

  classForm.addEventListener("submit", handleClassSubmit);
  document.getElementById("reset-class-form").addEventListener("click", resetClassForm);
  searchInput.addEventListener("input", renderReservations);
  dateFilter.addEventListener("change", renderReservations);
  statusFilter.addEventListener("change", renderReservations);
  document.getElementById("clear-reservation-filters").addEventListener("click", () => {
    searchInput.value = "";
    dateFilter.value = "";
    statusFilter.value = "all";
    renderReservations();
  });

  classList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    await handleClassAction(action, id);
  });

  reservationList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-reservation-action]");
    if (!target) return;
    await handleReservationCancel(target.dataset.id);
  });

  supabase.auth.onAuthStateChange((event) => {
    window.setTimeout(async () => {
      if (event === "SIGNED_IN") {
      try {
        const isAdmin = await ensureAdminAccess();
        if (isAdmin) {
          await loadClasses();
          await loadReservations();
        }
      } catch (error) {
        console.error(error);
        setStatus(statusBox, "No se pudo validar el acceso administrativo.", "error");
      }
      }

      if (event === "SIGNED_OUT") {
        showAuthView();
        loginForm.reset();
      }
    }, 0);
  });

  (async function initAuthState() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) {
        const isAdmin = await ensureAdminAccess();
        if (isAdmin) {
          await loadClasses();
          await loadReservations();
        }
      } else {
        showAuthView();
      }
    } catch (error) {
      console.error("Error restoring admin session", error);
      setStatus(statusBox, "No se pudo validar la sesión. Intenta iniciar sesión nuevamente.", "error");
      showAuthView();
    }
  })();
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
