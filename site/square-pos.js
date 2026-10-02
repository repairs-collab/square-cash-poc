export const DEFAULT_REQUEST = Object.freeze({
  amount: "1.00",
  currencyCode: "AUD",
  notes: "AroFlo Square Cash Test",
  version: "1.3",
});

const applicationIdPlaceholder = "sq0idp-your-production-application-id";
const amountError =
  "Enter a positive AUD amount with no more than two decimal places.";

export function parseAudAmountToMinorUnits(amountText) {
  const normalized = String(amountText ?? "").trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    throw new Error(amountError);
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const minorUnits = whole * 100n + fraction;

  if (minorUnits <= 0n) {
    throw new Error(amountError);
  }

  return minorUnits.toString();
}

export function callbackUrlForPage(pageUrl) {
  return new URL("callback.html", new URL(pageUrl)).href;
}

export function createRequestState(
  uuidFactory = () => globalThis.crypto.randomUUID(),
) {
  return `aroflo-square-cash-test:${uuidFactory()}`;
}

export function buildSquarePayload({
  applicationId,
  callbackUrl,
  amount = DEFAULT_REQUEST.amount,
  notes = DEFAULT_REQUEST.notes,
  state,
}) {
  return {
    amount_money: {
      amount: parseAudAmountToMinorUnits(amount),
      currency_code: DEFAULT_REQUEST.currencyCode,
    },
    callback_url: callbackUrl,
    client_id: applicationId,
    version: DEFAULT_REQUEST.version,
    notes,
    state,
    options: {
      supported_tender_types: ["CASH"],
      skip_receipt: false,
      auto_return: false,
    },
  };
}

export function buildSquareDeepLink(payload) {
  return (
    "square-commerce-v1://payment/create?data=" +
    encodeURIComponent(JSON.stringify(payload))
  );
}

export function detectIosDevice(navigatorLike) {
  const userAgent = String(navigatorLike?.userAgent ?? "");
  const platform = String(navigatorLike?.platform ?? "");
  const maxTouchPoints = Number(navigatorLike?.maxTouchPoints ?? 0);

  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    /iPad|iPhone|iPod/i.test(platform) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function validateLaunchReadiness({
  applicationId,
  callbackUrl,
  amount,
  navigatorLike,
  pageUrl,
}) {
  const errors = [];
  const normalizedApplicationId = String(applicationId ?? "").trim();

  if (!normalizedApplicationId) {
    errors.push("Enter the Square production application ID.");
  } else if (normalizedApplicationId === applicationIdPlaceholder) {
    errors.push("Replace the application ID placeholder before launching Square.");
  } else if (!/^sq0idp-[A-Za-z0-9_-]+$/.test(normalizedApplicationId)) {
    errors.push("Use a production Square application ID beginning with sq0idp-.");
  }

  try {
    parseAudAmountToMinorUnits(amount);
  } catch {
    errors.push(amountError);
  }

  try {
    const callback = new URL(callbackUrl);
    if (callback.protocol !== "https:") {
      errors.push("The Square callback URL must use HTTPS.");
    }
    if (pageUrl && callback.origin !== new URL(pageUrl).origin) {
      errors.push("The callback URL must use the same origin as this page.");
    }
  } catch {
    errors.push("Enter a valid Square callback URL.");
  }

  if (!detectIosDevice(navigatorLike)) {
    errors.push("Live Square launch is available only on iPhone or iPad.");
  }

  return errors;
}

function callbackField(raw, name) {
  return typeof raw[name] === "string" && raw[name] ? raw[name] : null;
}

function invalidCallbackResult(message, raw = null) {
  return {
    kind: "invalid",
    status: null,
    transactionId: null,
    clientTransactionId: null,
    errorCode: null,
    state: null,
    raw,
    message,
  };
}

export function parseSquareCallback(callbackUrl) {
  let dataParameter;

  try {
    dataParameter = new URL(callbackUrl).searchParams.get("data");
  } catch {
    return invalidCallbackResult("The callback URL is invalid.");
  }

  if (!dataParameter) {
    return invalidCallbackResult("No Square result data was returned.");
  }

  let raw;
  try {
    raw = JSON.parse(dataParameter);
  } catch {
    try {
      if (!/^%7B/i.test(dataParameter)) {
        throw new Error("Not an encoded object");
      }
      raw = JSON.parse(decodeURIComponent(dataParameter));
    } catch {
      return invalidCallbackResult("Square result data could not be decoded.");
    }
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return invalidCallbackResult("Square result data was not a JSON object.", raw);
  }

  const status = callbackField(raw, "status");
  const transactionId = callbackField(raw, "transaction_id");
  const clientTransactionId = callbackField(raw, "client_transaction_id");
  const errorCode = callbackField(raw, "error_code");
  const state = callbackField(raw, "state");

  if (status === "ok") {
    return {
      kind: "success",
      status,
      transactionId,
      clientTransactionId,
      errorCode: null,
      state,
      raw,
      message: transactionId
        ? "Square reported a successful payment."
        : "Square reported success, but no server transaction ID was returned. This can occur for cash or offline processing.",
    };
  }

  if (status === "error") {
    return {
      kind: "error",
      status,
      transactionId: null,
      clientTransactionId,
      errorCode,
      state,
      raw,
      message:
        errorCode === "payment_canceled"
          ? "The Square payment was canceled."
          : `Square reported an error${errorCode ? `: ${errorCode}` : ""}.`,
    };
  }

  return invalidCallbackResult("Square returned an unrecognized result status.", raw);
}
