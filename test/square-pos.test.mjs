import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REQUEST,
  buildSquareDeepLink,
  buildSquarePayload,
  callbackUrlForPage,
  createRequestState,
  detectIosDevice,
  parseAudAmountToMinorUnits,
  productionApplicationIdOrNull,
  validateLaunchReadiness,
} from "../site/square-pos.js";

const productionApplicationId = "sq0idp-productionApplication123";
const callbackUrl =
  "https://repairs-collab.github.io/square-cash-poc/callback.html";

const iosNavigator = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  platform: "iPhone",
  maxTouchPoints: 5,
};

test("converts AUD decimal strings to minor-unit strings", () => {
  assert.equal(parseAudAmountToMinorUnits("1.00"), "100");
  assert.equal(parseAudAmountToMinorUnits("1"), "100");
  assert.equal(parseAudAmountToMinorUnits("0.01"), "1");
});

test("rejects unsafe or malformed AUD amounts", () => {
  for (const amount of ["0", "0.00", "-1.00", "1,00", "abc", "1.001", ""]) {
    assert.throws(
      () => parseAudAmountToMinorUnits(amount),
      /positive AUD amount with no more than two decimal places/,
      amount,
    );
  }
});

test("derives the stable GitHub Pages callback URL", () => {
  assert.equal(
    callbackUrlForPage("https://repairs-collab.github.io/square-cash-poc/"),
    callbackUrl,
  );
});

test("creates a recognizable request state", () => {
  assert.equal(
    createRequestState(() => "fixed-uuid"),
    "aroflo-square-cash-test:fixed-uuid",
  );
});

test("builds the exact Square CASH payload", () => {
  const payload = buildSquarePayload({
    applicationId: productionApplicationId,
    callbackUrl,
    amount: "1.00",
    notes: "AroFlo Square Cash Test",
    state: "aroflo-square-cash-test:fixed-uuid",
  });

  assert.deepEqual(payload, {
    amount_money: {
      amount: "100",
      currency_code: "AUD",
    },
    callback_url: callbackUrl,
    client_id: productionApplicationId,
    version: "1.3",
    notes: "AroFlo Square Cash Test",
    state: "aroflo-square-cash-test:fixed-uuid",
    options: {
      supported_tender_types: ["CASH"],
      skip_receipt: false,
      auto_return: false,
    },
  });
});

test("encodes one JSON payload in the Square deep link", () => {
  const payload = buildSquarePayload({
    applicationId: productionApplicationId,
    callbackUrl,
    amount: DEFAULT_REQUEST.amount,
    notes: DEFAULT_REQUEST.notes,
    state: "aroflo-square-cash-test:fixed-uuid",
  });
  const deepLink = buildSquareDeepLink(payload);

  assert.match(deepLink, /^square-commerce-v1:\/\/payment\/create\?data=/);
  const encodedData = deepLink.slice(deepLink.indexOf("data=") + 5);
  assert.deepEqual(JSON.parse(decodeURIComponent(encodedData)), payload);
});

test("detects iOS and iPadOS desktop mode but rejects Windows", () => {
  assert.equal(detectIosDevice(iosNavigator), true);
  assert.equal(
    detectIosDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    detectIosDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      platform: "Win32",
      maxTouchPoints: 0,
    }),
    false,
  );
});

test("accepts only production Square application IDs for storage and previews", () => {
  assert.equal(
    productionApplicationIdOrNull("  sq0idp-productionApplication123  "),
    productionApplicationId,
  );

  for (const value of [
    "",
    "sq0idp-your-production-application-id",
    "sandbox-sq0idb-example",
    "EAAA-access-token-like-value",
    "not a Square application ID",
  ]) {
    assert.equal(productionApplicationIdOrNull(value), null, value);
  }
});

test("accepts a complete live-launch configuration", () => {
  assert.deepEqual(
    validateLaunchReadiness({
      applicationId: productionApplicationId,
      callbackUrl,
      amount: "1.00",
      navigatorLike: iosNavigator,
      pageUrl: "https://repairs-collab.github.io/square-cash-poc/",
    }),
    [],
  );
});

test("blocks incomplete, placeholder, Sandbox, HTTP, Windows, and mismatched launch configurations", () => {
  const cases = [
    {
      input: { applicationId: "" },
      expected: "Enter the Square production application ID.",
    },
    {
      input: { applicationId: "sq0idp-your-production-application-id" },
      expected: "Replace the application ID placeholder before launching Square.",
    },
    {
      input: { applicationId: "sandbox-sq0idb-example" },
      expected: "Use a production Square application ID beginning with sq0idp-.",
    },
    {
      input: { callbackUrl: "http://example.test/callback.html" },
      expected: "The Square callback URL must use HTTPS.",
    },
    {
      input: {
        navigatorLike: {
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          platform: "Win32",
          maxTouchPoints: 0,
        },
      },
      expected: "Live Square launch is available only on iPhone or iPad.",
    },
    {
      input: { amount: "1.001" },
      expected: "Enter a positive AUD amount with no more than two decimal places.",
    },
    {
      input: { callbackUrl: "https://other.example/callback.html" },
      expected: "The callback URL must use the same origin as this page.",
    },
  ];

  for (const { input, expected } of cases) {
    const errors = validateLaunchReadiness({
      applicationId: productionApplicationId,
      callbackUrl,
      amount: "1.00",
      navigatorLike: iosNavigator,
      pageUrl: "https://repairs-collab.github.io/square-cash-poc/",
      ...input,
    });
    assert.ok(errors.includes(expected), expected);
  }
});
