"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const enabled = process.env.KBE_RUN_SUPABASE_INTEGRATION === "true";
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const classId = process.env.KBE_TEST_CLASS_ID;
const adminToken = process.env.KBE_TEST_ADMIN_ACCESS_TOKEN;
const phoneTokenOne = process.env.KBE_TEST_PHONE_1_ACCESS_TOKEN;
const phoneTokenTwo = process.env.KBE_TEST_PHONE_2_ACCESS_TOKEN;
const unverifiedToken = process.env.KBE_UNVERIFIED_ACCESS_TOKEN;

function authHeaders(token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`
  };
}

test(
  "anonymous API cannot read reservations, mutate classes or book",
  { skip: !enabled || !supabaseUrl || !anonKey },
  async () => {
    const base = supabaseUrl.replace(/\/$/, "");
    const headers = authHeaders(anonKey);
    const [publicClassesResponse, reservationsResponse, classesResponse, bookingResponse] = await Promise.all([
      fetch(
        `${base}/rest/v1/published_classes_public?select=id,title,starts_at,ends_at,capacity,status,available_slots&limit=1`,
        { headers }
      ),
      fetch(`${base}/rest/v1/reservations?select=id,student_name,phone,email`, { headers }),
      fetch(`${base}/rest/v1/classes`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          title: "Test anon should not create",
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
          capacity: 1
        })
      }),
      fetch(`${base}/rest/v1/rpc/book_class`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_class_id: "00000000-0000-0000-0000-000000000000",
          p_student_name: "Test anon should not book",
          p_phone: "56900000000",
          p_email: null
        })
      })
    ]);

    assert.equal(publicClassesResponse.ok, true, "Anonymous access to public class projection should succeed.");
    const publicClasses = await publicClassesResponse.json();
    for (const classItem of publicClasses) {
      assert.deepEqual(
        Object.keys(classItem).sort(),
        ["available_slots", "capacity", "ends_at", "id", "starts_at", "status", "title"].sort(),
        "The public class projection should expose only its allowlisted columns."
      );
    }
    assert.notEqual(reservationsResponse.status, 200, "Anonymous access unexpectedly listed reservation data.");
    assert.ok(
      [401, 403, 404].includes(classesResponse.status),
      `Anonymous class insert should be denied, got HTTP ${classesResponse.status}.`
    );
    assert.ok(
      [401, 403, 404].includes(bookingResponse.status),
      `Anonymous booking RPC should be denied, got HTTP ${bookingResponse.status}.`
    );
  }
);

test(
  "authenticated non-admin cannot read or modify private data",
  { skip: !enabled || !supabaseUrl || !anonKey || !process.env.KBE_NON_ADMIN_ACCESS_TOKEN },
  async () => {
    const base = supabaseUrl.replace(/\/$/, "");
    const headers = authHeaders(process.env.KBE_NON_ADMIN_ACCESS_TOKEN);
    const [classesResponse, reservationsResponse, mutationResponse] = await Promise.all([
      fetch(`${base}/rest/v1/classes?select=id`, { headers }),
      fetch(`${base}/rest/v1/reservations?select=id,student_name,phone,email`, { headers }),
      fetch(`${base}/rest/v1/classes`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          title: "Test non-admin should not create",
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
          capacity: 1
        })
      })
    ]);

    assert.equal(classesResponse.ok, true, "Authenticated non-admin should get an RLS-filtered class response.");
    assert.deepEqual(await classesResponse.json(), []);
    assert.equal(reservationsResponse.ok, true, "Authenticated non-admin should get an RLS-filtered reservation response.");
    assert.deepEqual(await reservationsResponse.json(), []);
    assert.ok(
      [401, 403, 404].includes(mutationResponse.status),
      `Non-admin class insert should be denied, got HTTP ${mutationResponse.status}.`
    );
  }
);

test(
  "authenticated user without a verified phone cannot book",
  {
    skip: !enabled || !supabaseUrl || !anonKey || !classId || !unverifiedToken,
    timeout: 10_000
  },
  async () => {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/book_class`,
      {
        method: "POST",
        headers: {
          ...authHeaders(unverifiedToken),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_class_id: classId,
          p_student_name: "Test unverified phone",
          p_phone: "56900000000",
          p_email: null
        })
      }
    );
    const result = await response.json();

    assert.equal(response.ok, false, "RPC accepted an authenticated user without a verified phone.");
    assert.match(String(result.message), /PHONE_VERIFICATION_REQUIRED/);
  }
);

test(
  "RPC confirms exactly one of two verified phone accounts for the last class slot",
  {
    skip: !enabled || !supabaseUrl || !anonKey || !classId || !adminToken || !phoneTokenOne || !phoneTokenTwo,
    timeout: 20_000
  },
  async () => {
    const base = supabaseUrl.replace(/\/$/, "");
    const url = `${base}/rest/v1/rpc/book_class`;
    const phoneTokens = [phoneTokenOne, phoneTokenTwo];
    const phoneUsers = await Promise.all(phoneTokens.map(async (token) => {
      const response = await fetch(`${base}/auth/v1/user`, {
        headers: authHeaders(token)
      });
      assert.equal(response.ok, true, "Could not load a phone account for the concurrency test.");
      const user = await response.json();
      assert.ok(user.phone_confirmed_at && user.phone, "Concurrency accounts must have verified phone numbers.");
      return user;
    }));
    const phones = phoneUsers.map((user) => String(user.phone).replace(/\D/g, ""));
    assert.notEqual(phones[0], phones[1], "Concurrency test accounts must use distinct verified phone numbers.");

    const classResponse = await fetch(
      `${base}/rest/v1/published_classes_public?id=eq.${encodeURIComponent(classId)}&select=id,available_slots`,
      { headers: authHeaders(anonKey) }
    );
    assert.equal(classResponse.ok, true, "Could not read the public class availability.");
    const [testClass] = await classResponse.json();
    assert.ok(testClass, "The configured test class must be published and future.");
    assert.equal(
      testClass.available_slots,
      1,
      "Configure an isolated published class with exactly one remaining slot before running the concurrency test."
    );
    const existingTestReservationsResponse = await fetch(
      `${base}/rest/v1/reservations?class_id=eq.${encodeURIComponent(classId)}&phone=in.(${phones.join(",")})&status=eq.confirmed&select=id,phone`,
      { headers: authHeaders(adminToken) }
    );
    assert.equal(existingTestReservationsResponse.ok, true, "Could not check for existing test-phone reservations.");
    assert.deepEqual(
      await existingTestReservationsResponse.json(),
      [],
      "The verified test accounts must not already have confirmed reservations in the test class."
    );

    const mismatchPhone = `${phones[0].slice(0, -1)}${phones[0].endsWith("0") ? "1" : "0"}`;
    const phonesToCleanup = [...phones, mismatchPhone];

    try {
      const mismatchResponse = await fetch(url, {
        method: "POST",
        headers: {
          ...authHeaders(phoneTokens[0]),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_class_id: classId,
          p_student_name: "Test mismatched phone",
          p_phone: mismatchPhone,
          p_email: null
        })
      });
      const mismatchResult = await mismatchResponse.json();
      assert.equal(mismatchResponse.ok, false, "RPC accepted a phone different from the verified account.");
      assert.match(String(mismatchResult.message), /VERIFIED_PHONE_MISMATCH/);

      const payloads = phones.map((phone, index) => ({
        p_class_id: classId,
        p_student_name: `Test concurrency ${index + 1}`,
        p_phone: phone,
        p_email: null
      }));

      const results = await Promise.all(payloads.map(async (body, index) => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            ...authHeaders(phoneTokens[index]),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        return {
          ok: response.ok,
          body: await response.json()
        };
      }));

      assert.equal(
        results.filter((result) => result.ok).length,
        1,
        `Expected one booking only; received: ${JSON.stringify(results)}`
      );
      assert.equal(
        results.filter((result) => !result.ok && String(result.body.message).includes("CLASS_FULL")).length,
        1,
        `The losing booking should report CLASS_FULL: ${JSON.stringify(results)}`
      );
    } finally {
      const cleanupResponse = await fetch(
        `${base}/rest/v1/reservations?class_id=eq.${encodeURIComponent(classId)}&phone=in.(${phonesToCleanup.join(",")})`,
        {
          method: "DELETE",
          headers: {
            ...authHeaders(adminToken),
            Prefer: "return=minimal"
          }
        }
      );
      assert.equal(cleanupResponse.ok, true, "Could not remove synthetic test reservations; inspect the test class manually.");
    }
  }
);
