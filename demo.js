"use strict";

(function initLocalDemo() {
  const utils = window.KBEReservationUtils;
  const classes = [];
  const reservations = [];
  const classSelect = document.getElementById("demo-class");
  const classList = document.getElementById("demo-classes");
  const reservationList = document.getElementById("demo-reservations-list");
  const form = document.getElementById("demo-book-form");
  const status = document.getElementById("demo-book-status");
  const search = document.getElementById("demo-search");
  const date = document.getElementById("demo-date");
  const reservationStatus = document.getElementById("demo-status");

  if (!utils || !classSelect || !classList || !reservationList || !form || !status) return;

  function futureDate(daysFromNow, hour) {
    function addDays(dateString, days) {
      const [year, month, day] = dateString.split("-").map(Number);
      const dateValue = new Date(Date.UTC(year, month - 1, day + days));
      return dateValue.toISOString().slice(0, 10);
    }

    let targetDate = addDays(utils.getDateInTimeZone(new Date()), daysFromNow);
    let target = utils.dateTimeLocalToISO(`${targetDate}T${String(hour).padStart(2, "0")}:00`);
    if (new Date(target).getTime() <= Date.now()) {
      targetDate = addDays(targetDate, 1);
      target = utils.dateTimeLocalToISO(`${targetDate}T${String(hour).padStart(2, "0")}:00`);
    }
    return target;
  }

  const todayDate = utils.getDateInTimeZone(new Date());
  classes.push(
    { id: "demo-today", title: "Muay Thai · Resumen demo", starts_at: utils.dateTimeLocalToISO(`${todayDate}T10:00`), capacity: 8, status: "published" },
    { id: "demo-kickboxing", title: "Kick boxing · Demo", starts_at: futureDate(0, 19), capacity: 3, status: "published" },
    { id: "demo-muaythai", title: "Muay Thai · Demo", starts_at: futureDate(1, 20), capacity: 2, status: "published" },
    { id: "demo-full", title: "Preparación física · Demo", starts_at: futureDate(2, 18), capacity: 2, status: "published" }
  );
  reservations.push(
    { id: "demo-res-today-1", class_id: "demo-today", student_name: "Alumna Demo C", phone: "56900000003", email: null, status: "confirmed", created_at: new Date().toISOString() },
    { id: "demo-res-today-2", class_id: "demo-today", student_name: "Alumno Demo D", phone: "56900000004", email: null, status: "confirmed", created_at: new Date().toISOString() },
    { id: "demo-res-1", class_id: "demo-full", student_name: "Alumna Demo A", phone: "56900000001", email: null, status: "confirmed", created_at: new Date().toISOString() },
    { id: "demo-res-2", class_id: "demo-full", student_name: "Alumno Demo B", phone: "56900000002", email: null, status: "confirmed", created_at: new Date().toISOString() }
  );

  function formatDate(value) {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function setStatus(message, success = false) {
    status.textContent = message;
    status.dataset.state = success ? "success" : "error";
  }

  function render() {
    const items = classes.map((item) => {
      const reserved_count = reservations.filter(
        (reservation) => reservation.class_id === item.id && reservation.status === "confirmed"
      ).length;
      return { ...item, reserved_count };
    });

    classSelect.innerHTML = '<option value="">Selecciona una clase</option>' + items
      .filter((item) => item.status === "published")
      .map((item) => {
        const availability = utils.getClassAvailability(item);
        return `<option value="${utils.escapeHtml(item.id)}" ${availability.isFull ? "disabled" : ""}>${utils.escapeHtml(item.title)} · ${availability.available} cupos</option>`;
      }).join("");

    classList.innerHTML = items.map((item) => {
      const availability = utils.getClassAvailability(item);
      return `
        <article class="admin-class-item ${item.status === "cancelled" ? "is-cancelled" : ""}">
          <div class="admin-class-head">
            <div><h3>${utils.escapeHtml(item.title)}</h3><p>${formatDate(item.starts_at)}</p></div>
            <span class="admin-badge admin-badge-${item.status}">${item.status === "cancelled" ? "Cancelada" : item.status === "published" ? "Publicada" : "Borrador"}</span>
          </div>
          <div class="admin-class-meta">
            <span>Capacidad: ${availability.capacity}</span>
            <span>Reservas: ${availability.reserved}</span>
            <span>Disponibles: ${availability.available}</span>
          </div>
          ${item.status === "published" ? `<button class="button button-dark" type="button" data-demo-cancel-class="${utils.escapeHtml(item.id)}">Cancelar clase demo</button>` : ""}
        </article>
      `;
    }).join("");

    renderReservations();
    renderSummary(items);
  }

  function renderReservations() {
    const classesById = new Map(classes.map((item) => [item.id, item]));
    const rows = reservations.map((item) => {
      const classItem = classesById.get(item.class_id);
      return {
        ...item,
        class_title: classItem?.title || "Clase demo",
        class_starts_at: classItem?.starts_at || ""
      };
    });
    const filtered = utils.filterReservations(rows, {
      query: search.value,
      date: date.value,
      status: reservationStatus.value
    });

    if (!filtered.length) {
      reservationList.innerHTML = '<p class="empty-state">No hay reservas que coincidan.</p>';
      return;
    }

    reservationList.innerHTML = filtered.map((item) => `
      <article class="admin-reservation-item ${item.status === "cancelled" ? "is-cancelled" : ""}">
        <div class="admin-reservation-head">
          <div><h3>${utils.escapeHtml(item.student_name)}</h3><p>${utils.escapeHtml(item.class_title)} · ${formatDate(item.class_starts_at)}</p></div>
          <span class="admin-badge admin-badge-${item.status}">${item.status === "confirmed" ? "Confirmada" : "Cancelada"}</span>
        </div>
        <div class="admin-reservation-meta"><span>${utils.escapeHtml(item.phone)}</span><span>${item.email ? utils.escapeHtml(item.email) : "Sin correo"}</span></div>
        ${item.status === "confirmed" ? `<button class="button button-dark" type="button" data-demo-cancel-reservation="${utils.escapeHtml(item.id)}">Cancelar reserva demo</button>` : ""}
      </article>
    `).join("");
  }

  function renderSummary(items) {
    const summary = utils.summarizeToday(
      items,
      reservations,
      new Date()
    );
    document.getElementById("demo-summary-reservations").textContent = String(summary.reservationCount);
    document.getElementById("demo-summary-classes").textContent = String(summary.classCount);
    document.getElementById("demo-summary-occupancy").textContent = `${summary.occupancyPercent}%`;
    document.getElementById("demo-summary-capacity").textContent = `${summary.reservationCount} de ${summary.capacity} cupos ocupados`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const classId = classSelect.value;
    const name = document.getElementById("demo-name").value;
    const phone = document.getElementById("demo-phone").value;
    const message = utils.validateReservationInput({ classId, name, phone });
    if (message) {
      setStatus(message);
      return;
    }

    const classItem = classes.find((item) => item.id === classId);
    if (!classItem || classItem.status !== "published") {
      setStatus("La clase demo no está disponible.");
      return;
    }
    if (reservations.some((item) => item.class_id === classId && item.phone.replace(/\D/g, "") === phone.replace(/\D/g, "") && item.status === "confirmed")) {
      setStatus("Ese teléfono ya reservó la clase demo.");
      return;
    }
    const reserved = reservations.filter((item) => item.class_id === classId && item.status === "confirmed").length;
    if (reserved >= classItem.capacity) {
      setStatus("La clase demo está completa.");
      return;
    }

    reservations.unshift({
      id: `demo-res-${Date.now()}`,
      class_id: classId,
      student_name: name.trim(),
      phone: phone.trim(),
      email: null,
      status: "confirmed",
      created_at: new Date().toISOString()
    });
    form.reset();
    setStatus("Reserva ficticia agregada. No se envió ningún dato.", true);
    render();
  });

  classList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-demo-cancel-class]");
    if (!button) return;
    const classItem = classes.find((item) => item.id === button.dataset.demoCancelClass);
    if (!classItem || !window.confirm(`¿Cancelar "${classItem.title}" en esta demo?`)) return;
    classItem.status = "cancelled";
    render();
  });

  reservationList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-demo-cancel-reservation]");
    if (!button) return;
    const reservation = reservations.find((item) => item.id === button.dataset.demoCancelReservation);
    if (!reservation || !window.confirm("¿Cancelar esta reserva ficticia?")) return;
    reservation.status = "cancelled";
    render();
  });

  [search, date, reservationStatus].forEach((input) => {
    input.addEventListener("input", renderReservations);
    input.addEventListener("change", renderReservations);
  });

  document.getElementById("demo-clear-filters").addEventListener("click", () => {
    search.value = "";
    date.value = "";
    reservationStatus.value = "all";
    renderReservations();
  });

  render();
})();
