import assert from "node:assert/strict";
import test from "node:test";

import { parseSquareCallback } from "../site/square-pos.js";

const callbackBase =
  "https://repairs-collab.github.io/square-cash-poc/callback.html";

function callbackUrlForData(data) {
  return `${callbackBase}?data=${encodeURIComponent(JSON.stringify(data))}`;
}

test("parses a successful Square callback with transaction identifiers", () => {
  const raw = {
    status: "ok",
    transaction_id: "server-transaction-123",
    client_transaction_id: "client-transaction-456",
    state: "aroflo-square-cash-test:fixed-uuid",
    future_field: "preserved",
  };

  assert.deepEqual(parseSquareCallback(callbackUrlForData(raw)), {
    kind: "success",
    status: "ok",
    transactionId: "server-transaction-123",
    clientTransactionId: "client-transaction-456",
    errorCode: null,
    state: "aroflo-square-cash-test:fixed-uuid",
    raw,
    message: "Square reported a successful payment.",
  });
});

test("keeps a successful cash callback successful when transaction_id is absent", () => {
  const result = parseSquareCallback(
    callbackUrlForData({
      status: "ok",
      client_transaction_id: "client-cash-123",
    }),
  );

  assert.equal(result.kind, "success");
  assert.equal(result.transactionId, null);
  assert.equal(result.clientTransactionId, "client-cash-123");
  assert.equal(
    result.message,
    "Square reported success, but no server transaction ID was returned. This can occur for cash or offline processing.",
  );
});

test("parses a canceled Square payment", () => {
  const result = parseSquareCallback(
    callbackUrlForData({
      status: "error",
      error_code: "payment_canceled",
      state: "aroflo-square-cash-test:cancelled",
    }),
  );

  assert.equal(result.kind, "error");
  assert.equal(result.status, "error");
  assert.equal(result.errorCode, "payment_canceled");
  assert.equal(result.message, "The Square payment was canceled.");
});

test("parses one extra layer of percent encoding", () => {
  const raw = {
    status: "ok",
    transaction_id: "double-encoded-123",
  };
  const twiceEncoded = encodeURIComponent(
    encodeURIComponent(JSON.stringify(raw)),
  );
  const result = parseSquareCallback(`${callbackBase}?data=${twiceEncoded}`);

  assert.equal(result.kind, "success");
  assert.equal(result.transactionId, "double-encoded-123");
  assert.deepEqual(result.raw, raw);
});

test("returns invalid results for missing or malformed callback data", () => {
  const malformedUrls = [
    callbackBase,
    `${callbackBase}?data=%E0%A4%A`,
    `${callbackBase}?data=${encodeURIComponent("not json")}`,
    callbackUrlForData(["not", "an", "object"]),
    callbackUrlForData("not an object"),
    callbackUrlForData(42),
  ];

  for (const url of malformedUrls) {
    const result = parseSquareCallback(url);
    assert.equal(result.kind, "invalid", url);
    assert.equal(result.transactionId, null, url);
    assert.doesNotThrow(() => JSON.stringify(result), url);
  }
});

test("keeps HTML-like callback values as plain data", () => {
  const htmlLikeValue = '<img src=x onerror="alert(1)">';
  const result = parseSquareCallback(
    callbackUrlForData({
      status: "ok",
      transaction_id: htmlLikeValue,
    }),
  );

  assert.equal(result.transactionId, htmlLikeValue);
  assert.equal(result.raw.transaction_id, htmlLikeValue);
});
