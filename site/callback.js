import { parseSquareCallback } from "./square-pos.js";

const result = parseSquareCallback(window.location.href);
const elements = {
  card: document.querySelector('[data-role="result-card"]'),
  title: document.querySelector('[data-role="result-title"]'),
  message: document.querySelector('[data-role="message"]'),
  status: document.querySelector('[data-role="status"]'),
  transactionId: document.querySelector('[data-role="transaction-id"]'),
  clientTransactionId: document.querySelector('[data-role="client-transaction-id"]'),
  errorCode: document.querySelector('[data-role="error-code"]'),
  state: document.querySelector('[data-role="state"]'),
  raw: document.querySelector('[data-role="raw-result"]'),
  copy: document.querySelector('[data-role="copy-result"]'),
  copyStatus: document.querySelector('[data-role="copy-status"]'),
};

const titles = {
  success: "Payment completed",
  error: result.errorCode === "payment_canceled" ? "Payment canceled" : "Square reported an error",
  invalid: "No valid Square result",
};

elements.card.dataset.kind = result.kind;
elements.title.textContent = titles[result.kind];
elements.message.textContent = result.message;
elements.status.textContent = result.status ?? "Not returned";
elements.transactionId.textContent =
  result.transactionId ?? (result.kind === "success" ? "Unavailable" : "Not returned");
elements.clientTransactionId.textContent = result.clientTransactionId ?? "Not returned";
elements.errorCode.textContent = result.errorCode ?? "None";
elements.state.textContent = result.state ?? "Not returned";
elements.raw.textContent = result.raw
  ? JSON.stringify(result.raw, null, 2)
  : "No raw JSON object was returned.";

elements.copy.disabled = !result.raw;
elements.copy.addEventListener("click", async () => {
  if (!result.raw) {
    return;
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(result.raw, null, 2));
    elements.copyStatus.textContent = "Result JSON copied.";
  } catch {
    elements.copyStatus.textContent = "Copy was blocked by the browser. Select the JSON above to copy it manually.";
  }
});
