"use strict";

(function attachReservationUtils(root, factory) {
  const utils = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = utils;
  }
  root.KBEReservationUtils = utils;
})(globalThis, function createReservationUtils() {
  function getDateInTimeZone(value, timeZone = "America/Santiago") {
    if (!value) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(value));
    const part = (type) => parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function getDateTimeLocalInTimeZone(value, timeZone = "America/Santiago") {
    if (!value) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(value));
    const part = (type) => parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  }

  function dateTimeLocalToISO(value, timeZone = "America/Santiago") {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) return "";

    const [, year, month, day, hour, minute] = match.map(Number);
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = localAsUtc;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date(timestamp));
      const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, Number(partValue)]));
      const representedAsUtc = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute,
        values.second
      );
      timestamp = localAsUtc - (representedAsUtc - timestamp);
    }

    return new Date(timestamp).toISOString();
  }

  function validateReservationInput({ classId, name, phone, email = "" } = {}) {
    if (!String(classId || "").trim()) return "Selecciona una clase disponible.";
    if (!String(name || "").trim()) return "Ingresa tu nombre.";
    if (String(name).trim().length > 80) return "El nombre no puede superar 80 caracteres.";

    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      return "Ingresa un teléfono válido.";
    }

    const normalizedEmail = String(email || "").trim();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "El correo electrónico no tiene un formato válido.";
    }
    if (normalizedEmail.length > 120) {
      return "El correo electrónico no puede superar 120 caracteres.";
    }
    return "";
  }

  function getPhoneForAuth(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 8 || digits.length === 9) digits = `56${digits}`;
    if (digits.length < 10 || digits.length > 15) return "";
    return `+${digits}`;
  }

  function getPhoneDigits(value) {
    return getPhoneForAuth(value).replace(/\D/g, "");
  }

  function getBookingErrorMessage(error) {
    const message = String(error?.message || error?.details || "");
    if (message.includes("CLASS_FULL")) return "No quedan cupos disponibles en esta clase.";
    if (message.includes("ALREADY_RESERVED")) return "Ya tienes una reserva confirmada para esta clase.";
    if (message.includes("CLASS_UNAVAILABLE")) return "La clase no está disponible en este momento.";
    if (message.includes("CLASS_STARTED")) return "La clase ya ha comenzado y no acepta reservas.";
    if (message.includes("CLASS_NOT_FOUND")) return "La clase ya no está disponible.";
    if (message.includes("INVALID_PHONE")) return "Ingresa un teléfono válido para confirmar la reserva.";
    if (message.includes("INVALID_EMAIL")) return "El correo electrónico no tiene un formato válido.";
    if (message.includes("INVALID_STUDENT_NAME")) return "Ingresa tu nombre.";
    if (message.includes("PHONE_VERIFICATION_REQUIRED")) return "Verifica tu teléfono por SMS antes de reservar.";
    if (message.includes("VERIFIED_PHONE_MISMATCH")) return "La reserva debe usar el teléfono verificado por SMS.";
    if (message.includes("CAPACITY_BELOW_CONFIRMED_RESERVATIONS")) {
      return "La capacidad no puede quedar por debajo de las reservas confirmadas.";
    }
    return "No se pudo confirmar la reserva. Intenta nuevamente.";
  }

  function getClassAvailability(classItem = {}) {
    const capacity = Math.max(0, Number(classItem.capacity) || 0);
    const reserved = Math.max(0, Number(classItem.reserved_count) || 0);
    const isCancelled = classItem.status === "cancelled";
    const available = isCancelled ? 0 : Math.max(capacity - reserved, 0);
    return {
      capacity,
      reserved,
      available,
      isFull: available === 0,
      isCancelled
    };
  }

  function filterReservations(reservations, { query = "", date = "", status = "all" } = {}) {
    const search = String(query).trim().toLocaleLowerCase("es-CL");
    return (reservations || []).filter((reservation) => {
      if (status !== "all" && reservation.status !== status) return false;
      if (date && getDateInTimeZone(reservation.class_starts_at) !== date) return false;
      if (!search) return true;

      const searchable = [
        reservation.student_name,
        reservation.phone,
        reservation.email,
        reservation.class_title
      ].filter(Boolean).join(" ").toLocaleLowerCase("es-CL");
      return searchable.includes(search);
    });
  }

  function summarizeToday(classes, reservations, now = new Date()) {
    const today = getDateInTimeZone(now);
    const todayClasses = (classes || []).filter(
      (classItem) =>
        classItem.status !== "cancelled" &&
        getDateInTimeZone(classItem.starts_at) === today
    );
    const todayClassIds = new Set(todayClasses.map((classItem) => classItem.id));
    const reservationCount = (reservations || []).filter(
      (reservation) =>
        reservation.status === "confirmed" &&
        todayClassIds.has(reservation.class_id)
    ).length;
    const capacity = todayClasses.reduce(
      (total, classItem) => total + Math.max(0, Number(classItem.capacity) || 0),
      0
    );

    return {
      classCount: todayClasses.length,
      reservationCount,
      capacity,
      occupancyPercent: capacity ? Math.round((reservationCount / capacity) * 100) : 0
    };
  }

  async function fetchAllPages(fetchPage, pageSize = 500) {
    const rows = [];
    let offset = 0;

    while (true) {
      const { data, error } = await fetchPage(offset, pageSize);
      if (error) throw error;

      const page = Array.isArray(data) ? data : [];
      if (!page.length) return rows;
      rows.push(...page);
      offset += page.length;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  return {
    escapeHtml,
    dateTimeLocalToISO,
    fetchAllPages,
    filterReservations,
    getDateTimeLocalInTimeZone,
    getBookingErrorMessage,
    getClassAvailability,
    getDateInTimeZone,
    getPhoneDigits,
    getPhoneForAuth,
    summarizeToday,
    validateReservationInput
  };
});
