import {
  DEFAULT_REQUEST,
  buildSquareDeepLink,
  buildSquarePayload,
  callbackUrlForPage,
  createRequestState,
  parseAudAmountToMinorUnits,
  productionApplicationIdOrNull,
  validateLaunchReadiness,
} from "./square-pos.js";

const applicationIdPlaceholder = "sq0idp-your-production-application-id";
const storageKey = "square-cash-poc.application-id";

const elements = {
  form: document.querySelector('[data-role="request-form"]'),
  applicationId: document.querySelector('[data-role="application-id"]'),
  amount: document.querySelector('[data-role="amount"]'),
  reference: document.querySelector('[data-role="reference"]'),
  callbackUrl: document.querySelector('[data-role="callback-url"]'),
  validate: document.querySelector('[data-role="validate"]'),
  validation: document.querySelector('[data-role="validation"]'),
  payload: document.querySelector('[data-role="payload"]'),
  deepLink: document.querySelector('[data-role="deep-link"]'),
  confirmation: document.querySelector('[data-role="live-confirmation"]'),
  launch: document.querySelector('[data-role="launch"]'),
  launchHelp: document.querySelector('[data-role="launch-help"]'),
  simulateSuccess: document.querySelector('[data-role="simulate-success"]'),
  simulateCancel: document.querySelector('[data-role="simulate-cancel"]'),
};

let preparedRequest = null;

function formFingerprint() {
  return JSON.stringify({
    applicationId: elements.applicationId.value.trim(),
    amount: elements.amount.value.trim(),
    notes: elements.reference.value.trim(),
    callbackUrl: elements.callbackUrl.value,
  });
}

function setValidation(kind, title, messages = []) {
  elements.validation.replaceChildren();
  elements.validation.dataset.kind = kind;

  const heading = document.createElement("strong");
  heading.textContent = title;
  elements.validation.append(heading);

  if (messages.length) {
    const list = document.createElement("ul");
    for (const message of messages) {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    elements.validation.append(list);
  }
}

function updateLaunchAvailability() {
  const isCurrent =
    preparedRequest && preparedRequest.fingerprint === formFingerprint();
  const confirmed = elements.confirmation.checked;
  const launchReady = isCurrent && preparedRequest.launchErrors.length === 0;

  elements.confirmation.disabled = !launchReady;
  elements.launch.disabled = !(launchReady && confirmed);

  if (!isCurrent) {
    elements.launchHelp.textContent = "Validate the current request before launching Square.";
  } else if (preparedRequest.launchErrors.length) {
    elements.launchHelp.textContent = preparedRequest.launchErrors.join(" ");
  } else if (!confirmed) {
    elements.launchHelp.textContent = "Confirm the live-production warning to unlock Square.";
  } else {
    elements.launchHelp.textContent = "Ready. Square opens only when you press the button.";
  }
}

function invalidatePreparedRequest() {
  preparedRequest = null;
  elements.confirmation.checked = false;
  elements.confirmation.disabled = true;
  elements.launch.disabled = true;
  elements.payload.textContent = "Request changed. Validate again to display its JSON.";
  elements.deepLink.textContent = "Not generated.";
  setValidation("neutral", "Request changed", ["Validate again before using the request."]);
  updateLaunchAvailability();
}

function resultUrl(raw) {
  const url = new URL(elements.callbackUrl.value);
  url.searchParams.set("data", JSON.stringify(raw));
  return url.href;
}

function setSimulationLinks() {
  elements.simulateSuccess.href = resultUrl({
    status: "ok",
    transaction_id: "SIMULATED-SERVER-TRANSACTION-ID",
    client_transaction_id: "SIMULATED-CLIENT-TRANSACTION-ID",
    state: "aroflo-square-cash-test:simulated-success",
  });
  elements.simulateCancel.href = resultUrl({
    status: "error",
    error_code: "payment_canceled",
    state: "aroflo-square-cash-test:simulated-cancellation",
  });
}

function validateRequest() {
  const enteredApplicationId = elements.applicationId.value.trim();
  const productionApplicationId = productionApplicationIdOrNull(
    enteredApplicationId,
  );
  const payloadApplicationId =
    productionApplicationId ?? applicationIdPlaceholder;
  const amount = elements.amount.value.trim();
  const notes = elements.reference.value.trim() || DEFAULT_REQUEST.notes;

  try {
    parseAudAmountToMinorUnits(amount);
    const payload = buildSquarePayload({
      applicationId: payloadApplicationId,
      callbackUrl: elements.callbackUrl.value,
      amount,
      notes,
      state: createRequestState(),
    });
    const launchErrors = validateLaunchReadiness({
      applicationId: enteredApplicationId,
      callbackUrl: elements.callbackUrl.value,
      amount,
      navigatorLike: window.navigator,
      pageUrl: window.location.href,
    });

    preparedRequest = {
      payload,
      deepLink: buildSquareDeepLink(payload),
      launchErrors,
      fingerprint: formFingerprint(),
    };

    elements.payload.textContent = JSON.stringify(payload, null, 2);
    elements.deepLink.textContent = preparedRequest.deepLink;
    elements.confirmation.checked = false;

    if (productionApplicationId) {
      try {
        localStorage.setItem(storageKey, productionApplicationId);
      } catch {
        setValidation("warning", "Payload built; browser storage is unavailable", launchErrors);
        updateLaunchAvailability();
        return;
      }
    } else {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }

    if (launchErrors.length) {
      setValidation("warning", "Payload structure is valid; live launch is blocked", launchErrors);
    } else {
      setValidation("success", "Payload validated and ready for explicit iPad launch");
    }
  } catch (error) {
    preparedRequest = null;
    elements.payload.textContent = "No valid payload generated.";
    elements.deepLink.textContent = "Not generated.";
    setValidation("error", "Request could not be built", [error.message]);
  }

  updateLaunchAvailability();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  validateRequest();
});

for (const input of [elements.applicationId, elements.amount, elements.reference]) {
  input.addEventListener("input", invalidatePreparedRequest);
}

elements.confirmation.addEventListener("change", updateLaunchAvailability);

elements.launch.addEventListener("click", () => {
  updateLaunchAvailability();
  if (!elements.launch.disabled && preparedRequest) {
    window.location.href = preparedRequest.deepLink;
  }
});

elements.amount.value = DEFAULT_REQUEST.amount;
elements.reference.value = DEFAULT_REQUEST.notes;
elements.callbackUrl.value = callbackUrlForPage(window.location.href);

try {
  const storedApplicationId = localStorage.getItem(storageKey);
  elements.applicationId.value =
    productionApplicationIdOrNull(storedApplicationId) ?? "";
  if (storedApplicationId && !elements.applicationId.value) {
    localStorage.removeItem(storageKey);
  }
} catch {
  elements.applicationId.value = "";
}

setSimulationLinks();
updateLaunchAvailability();
