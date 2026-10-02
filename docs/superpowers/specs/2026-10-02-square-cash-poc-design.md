# Square Cash POS Proof-of-Concept Design

Date: 2 October 2026

## Purpose

Build a minimal, self-contained web harness that proves an AUD cash payment can be handed from a browser to the Square Point of Sale app on an iPad and that Square's callback result can be read clearly. The harness does not connect to, read from, or write to AroFlo.

Success means:

- Windows can validate and inspect the exact Square request without opening Square.
- An iPad can explicitly launch Square Point of Sale with an AUD $1.00 cash request.
- Square shows its digital receipt flow.
- Square returns to an HTTPS callback page that shows status, transaction ID, client transaction ID, state, error code, and the complete returned payload.
- No secret, access token, AroFlo credential, or customer data is required.

## Verified Square Contract

The iOS mobile-web request uses:

```text
square-commerce-v1://payment/create?data=<percent-encoded JSON>
```

The request JSON contains:

```json
{
  "amount_money": {
    "amount": "100",
    "currency_code": "AUD"
  },
  "callback_url": "https://<current-host>/callback.html",
  "client_id": "<Square application ID entered by the user>",
  "version": "1.3",
  "notes": "AroFlo Square Cash Test",
  "state": "<unique request correlation value>",
  "options": {
    "supported_tender_types": ["CASH"],
    "skip_receipt": false,
    "auto_return": false
  }
}
```

Square requires `amount_money`, `callback_url`, `client_id`, `version`, and `options`. `CASH` is an allowed iOS tender type. Setting `skip_receipt` to `false` shows the digital receipt options. Leaving `auto_return` false lets the user complete the receipt/Thank You flow before choosing to return.

The callback URL must exactly match the Web Callback URL configured for the Square application. It must be HTTPS for the iPad handoff. Square returns an iOS JSON result in the callback's `data` query parameter. Relevant fields are `status`, `transaction_id`, `client_transaction_id`, `error_code`, and `state`.

The Point of Sale API does not support Sandbox testing. Completing the iPad flow records a real production cash transaction in the signed-in Square account.

## Approaches Considered

### Selected: dedicated GitHub repository plus GitHub Pages

A dedicated public repository named `repairs-collab/square-cash-poc` contains the harness. GitHub Pages publishes the static site at `https://repairs-collab.github.io/square-cash-poc/`, providing a stable HTTPS address for the iPad and the exact callback `https://repairs-collab.github.io/square-cash-poc/callback.html`. A dependency-free Node.js development server also runs the same static files on the PC for local Windows validation.

### Local network only

The iPad could open the PC's LAN address on the same Wi-Fi. This is useful for ordinary browser testing but does not satisfy Square's HTTPS callback requirement without certificate and trust setup, so it is not the primary handoff path.

### Temporary HTTPS tunnel

A temporary tunnel could expose the local PC over HTTPS without a repository. Its address changes between runs and would require repeated Square callback reconfiguration, so it is less reliable for this proof of concept.

## Architecture

The deliverable contains five small parts:

1. A static GitHub Pages site and Pages deployment workflow in `repairs-collab/square-cash-poc`.
2. A minimal local Node.js static-file server with no runtime packages or external API calls.
3. A launch page that accepts the Square application ID, defaults to AUD $1.00 and the reference `AroFlo Square Cash Test`, validates the request, and displays the decoded payload.
4. A pure JavaScript module that validates input, converts dollars to cents, builds the Square payload/deep link, detects supported iOS browsing, and parses callback data.
5. A callback page that displays the returned Square identifiers and complete JSON without saving or forwarding it.

The Square application ID is entered into a clearly labelled field on the launch page and retained only in that browser's local storage for convenience. The field placeholder is `sq0idp-your-production-application-id`. The harness never asks for or accepts an access token, application secret, OAuth secret, password, or AroFlo credential. The application ID is included in the Square deep link because Square requires it; it is not treated as a secret.

## User Flow

### Windows validation

1. Start the local development server and open its localhost address, or open the published GitHub Pages site.
2. Enter a Square production application ID or use the visible placeholder for structure-only validation.
3. Select **Validate request**.
4. Inspect the checklist, decoded JSON, callback URL, amount `100`, currency `AUD`, tender `CASH`, API version `1.3`, and receipt setting `false`.
5. The Square launch control remains unavailable on Windows.
6. Open built-in simulated success and cancellation callback links to verify result rendering without creating a transaction.

### iPad handoff

1. Open `https://repairs-collab.github.io/square-cash-poc/` on the iPad.
2. Register `https://repairs-collab.github.io/square-cash-poc/callback.html` as the Web Callback URL under the application's Point of Sale API settings in Square Developer Console.
3. Paste the production Square application ID into the launch page.
4. Select **Validate request** and review the $1.00 cash payload.
5. Tick a confirmation stating that Square POS has no Sandbox and this can create a live cash transaction record.
6. Select **Open Square for CASH $1.00**. This explicit gesture is the only code path that navigates to the Square URL scheme.
7. Complete or cancel in Square. On success, complete the digital receipt flow and return to the callback page.
8. Review and optionally copy the returned identifiers and raw result.

## Safeguards

- Page load never opens Square and never creates a transaction.
- Generating or validating a payload never opens Square.
- Launch requires iOS/iPadOS, a valid-looking production application ID, an HTTPS callback, a successful validation state, an explicit live-transaction confirmation, and a separate button press.
- Any edit after validation invalidates the prepared request and disables launch until it is validated again.
- Tender is fixed to `CASH`; card and other tender choices are not exposed.
- Currency is fixed to `AUD`.
- The receipt option is fixed to `skip_receipt: false`.
- No payment or AroFlo network request is made by the page before the explicit Square launch; GitHub Pages and the local server only serve static files.
- Callback responses are rendered as text, not interpreted as HTML.
- The local server sends no-store headers for the callback page and result resources. The static callback page also declares no-store browser metadata; GitHub Pages controls its own HTTP cache headers, while each Square result remains in the callback URL's transaction-specific query data.

## Validation and Errors

The launch page reports configuration problems beside the relevant field and in a summary. It rejects a missing or placeholder application ID for launch, non-positive amounts, values with more than two decimal places, non-HTTPS iPad callbacks, and callback origins that do not match the page's current origin.

The callback page handles:

- successful results (`status: ok`), including the possible absence of `transaction_id` for offline or non-card processing;
- Square errors (`status: error` plus `error_code`);
- cancellation (`payment_canceled`);
- missing `data`;
- malformed percent encoding or malformed JSON;
- unknown fields, which remain visible in the raw result.

The page labels a missing server transaction ID as unavailable rather than treating it as proof of failure, because Square documents circumstances where the field can be absent.

## Testing

Automated tests use Node's built-in test runner locally and in GitHub Actions and cover:

- default AUD $1.00 conversion to `100` cents;
- exact required payload fields and fixed `CASH` tender;
- `skip_receipt: false` and `auto_return: false`;
- percent encoding and deep-link structure;
- validation failures for unsafe or incomplete launch configuration;
- iOS callback success, cancellation, malformed data, and missing transaction IDs;
- server delivery of launch and callback pages with no-store callback headers.

Manual checks cover responsive rendering, Windows launch prevention, explicit confirmation behavior, simulated callbacks, and the final iPad-to-Square-to-callback round trip. The automated suite cannot open the installed Square app, so the real iPad handoff remains a user-run acceptance test.

## Scope Boundaries

The proof of concept does not:

- modify or call AroFlo;
- use Square access tokens, secrets, Payments API calls, webhooks, or payment retrieval;
- reconcile Square transactions to AroFlo invoices;
- reverse, refund, or delete the test cash transaction;
- use a custom domain or general-purpose backend service;
- support Android or card tender.

## Official References

- Square, “Build on Mobile Web”: https://developer.squareup.com/docs/pos-api/build-mobile-web
- Square, “Mobile Web Technical Reference”: https://developer.squareup.com/docs/pos-api/web-technical-reference
- Square, “Point of Sale API”: https://developer.squareup.com/docs/pos-api/what-it-does
