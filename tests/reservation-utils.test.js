"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  filterReservations,
  fetchAllPages,
  dateTimeLocalToISO,
  escapeHtml,
  getBookingErrorMessage,
  getClassAvailability,
  getDateTimeLocalInTimeZone,
  getDateInTimeZone,
  getPhoneDigits,
  getPhoneForAuth,
  summarizeToday,
  validateReservationInput
} = require("../reservation-utils.js");

test("reservation validation rejects missing class, name and invalid phone", () => {
  assert.equal(validateReservationInput({}), "Selecciona una clase disponible.");
  assert.equal(
    validateReservationInput({ classId: "class-1", name: "  ", phone: "56912345678" }),
    "Ingresa tu nombre."
  );
  assert.equal(
    validateReservationInput({ classId: "class-1", name: "Ana", phone: "123" }),
    "Ingresa un teléfono válido."
  );
});

test("reservation validation accepts Chilean phone punctuation and optional email", () => {
  assert.equal(
    validateReservationInput({
      classId: "class-1",
      name: " Ana Pérez ",
      phone: "+56 9 1234-5678",
      email: ""
    }),
    ""
  );
  assert.equal(
    validateReservationInput({
      classId: "class-1",
      name: "Ana",
      phone: "56912345678",
      email: "not-an-email"
    }),
    "El correo electrónico no tiene un formato válido."
  );
});

test("phone normalization returns E.164 for SMS verification", () => {
  assert.equal(getPhoneForAuth("+56 9 1234-5678"), "+56912345678");
  assert.equal(getPhoneForAuth("912345678"), "+56912345678");
  assert.equal(getPhoneForAuth("0012125551234"), "+12125551234");
  assert.equal(getPhoneForAuth("123"), "");
  assert.equal(getPhoneDigits("+56 9 1234-5678"), "56912345678");
});

test("availability clamps full and cancelled classes to zero", () => {
  assert.deepEqual(getClassAvailability({ capacity: 25, reserved_count: 24 }), {
    capacity: 25,
    reserved: 24,
    available: 1,
    isFull: false,
    isCancelled: false
  });
  assert.equal(
    getClassAvailability({ capacity: 25, reserved_count: 30 }).available,
    0
  );
  assert.equal(
    getClassAvailability({ capacity: 25, reserved_count: 0, status: "cancelled" }).isCancelled,
    true
  );
});

test("user-provided strings are escaped before HTML rendering", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("booking errors map to clear public messages", () => {
  assert.match(getBookingErrorMessage({ message: "CLASS_FULL" }), /No quedan cupos/);
  assert.match(getBookingErrorMessage({ message: "ALREADY_RESERVED" }), /Ya tienes una reserva/);
  assert.match(
    getBookingErrorMessage({ message: "PHONE_VERIFICATION_REQUIRED" }),
    /Verifica tu teléfono/
  );
  assert.match(
    getBookingErrorMessage({ message: "VERIFIED_PHONE_MISMATCH" }),
    /teléfono verificado/
  );
  assert.match(
    getBookingErrorMessage({ message: "CAPACITY_BELOW_CONFIRMED_RESERVATIONS" }),
    /capacidad no puede quedar/
  );
  assert.match(getBookingErrorMessage({ message: "network failure" }), /No se pudo confirmar/);
});

test("date filters use the America/Santiago calendar date", () => {
  assert.equal(getDateInTimeZone("2026-10-30T02:30:00Z", "America/Santiago"), "2026-10-29");
  assert.equal(getDateTimeLocalInTimeZone("2026-10-30T21:00:00Z"), "2026-10-30T18:00");
  assert.equal(dateTimeLocalToISO("2026-10-30T18:00"), "2026-10-30T21:00:00.000Z");
  assert.equal(dateTimeLocalToISO("invalid"), "");
});

test("reservation search, date and status filters compose", () => {
  const reservations = [
    {
      student_name: "Ana Pérez",
      phone: "56911111111",
      email: "ana@example.com",
      status: "confirmed",
      class_title: "Kick boxing",
      class_starts_at: "2026-10-30T18:00:00-03:00"
    },
    {
      student_name: "Luis Soto",
      phone: "56922222222",
      email: null,
      status: "cancelled",
      class_title: "Muay Thai",
      class_starts_at: "2026-10-31T18:00:00-03:00"
    }
  ];

  assert.equal(filterReservations(reservations, { query: "ANA" }).length, 1);
  assert.equal(filterReservations(reservations, { query: "569222" }).length, 1);
  assert.equal(
    filterReservations(reservations, { date: "2026-10-30", status: "confirmed" }).length,
    1
  );
  assert.equal(filterReservations(reservations, { status: "cancelled" }).length, 1);
});

test("daily summary counts confirmed reservations against classes starting today", () => {
  const classes = [
    { id: "today", starts_at: "2026-10-30T19:00:00-03:00", capacity: 10, status: "published" },
    { id: "tomorrow", starts_at: "2026-10-31T19:00:00-03:00", capacity: 20, status: "published" }
  ];
  const reservations = [
    { class_id: "today", status: "confirmed" },
    { class_id: "today", status: "confirmed" },
    { class_id: "today", status: "cancelled" },
    { class_id: "tomorrow", status: "confirmed" }
  ];

  assert.deepEqual(
    summarizeToday(classes, reservations, new Date("2026-10-30T15:00:00-03:00")),
    { classCount: 1, reservationCount: 2, capacity: 10, occupancyPercent: 20 }
  );
});

test("daily summary includes today's classes that have already started", () => {
  const classes = [
    { id: "morning", starts_at: "2026-10-30T09:00:00-03:00", capacity: 10, status: "published" }
  ];
  const reservations = [
    { class_id: "morning", status: "confirmed" },
    { class_id: "morning", status: "confirmed" }
  ];

  assert.deepEqual(
    summarizeToday(classes, reservations, new Date("2026-10-30T15:00:00-03:00")),
    { classCount: 1, reservationCount: 2, capacity: 10, occupancyPercent: 20 }
  );
});

test("pagination continues until all rows are retrieved, even below requested page size", async () => {
  const rows = ["a", "b", "c", "d", "e"];
  const offsets = [];
  const result = await fetchAllPages(async (offset, pageSize) => {
    offsets.push(offset);
    return { data: rows.slice(offset, offset + Math.min(pageSize, 2)), error: null };
  }, 3);

  assert.deepEqual(result, rows);
  assert.deepEqual(offsets, [0, 2, 4, 5]);
});

test("pagination surfaces query errors", async () => {
  await assert.rejects(
    fetchAllPages(async () => ({ data: null, error: new Error("query failed") })),
    /query failed/
  );
});
