# Square Cash POS Proof-of-Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a safe, CASH-only Square Point of Sale mobile-web proof of concept with local Windows validation and a stable GitHub Pages callback for iPad testing.

**Architecture:** A dependency-free static site owns all Square request construction and callback parsing in a pure ES module. Thin browser scripts render and launch the prepared request only after explicit validation and confirmation. A small Node.js development server supports local validation, while GitHub Actions publishes the same `site/` directory to GitHub Pages.

**Tech Stack:** HTML, CSS, browser JavaScript ES modules, Node.js 24 built-in test runner and HTTP server, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-10-02-square-cash-poc-design.md`

## Global Constraints

- Create the public repository `repairs-collab/square-cash-poc`; do not modify `repairs-collab/aro` or AroFlo.
- Publish at `https://repairs-collab.github.io/square-cash-poc/` with callback `https://repairs-collab.github.io/square-cash-poc/callback.html`.
- Default amount is AUD `$1.00`, represented as minor-unit string `"100"`.
- Default note/reference is exactly `AroFlo Square Cash Test`.
- The iOS Point of Sale API version is exactly `1.3`.
- Tender is fixed to `options.supported_tender_types: ["CASH"]`.
- Receipt flow is fixed to `options.skip_receipt: false`; automatic return is fixed to `options.auto_return: false`.
- Loading or validating the page must never navigate to Square; only the explicit launch button handler may assign the deep link.
- Launch requires a production-style Square application ID, HTTPS callback, supported iOS/iPadOS browser, successful current validation, and live-transaction confirmation.
- No Square access token, secret, password, AroFlo credential, customer data, backend API, or runtime package is permitted.
- The callback displays returned data only; it does not persist, forward, retrieve, reconcile, refund, or delete transactions.
- The Point of Sale API is production-only; the UI and instructions must warn that completing the flow creates a real cash transaction record.
- On this PC, resolve `$nodeExe` to the system `node` command or `$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` before running Node commands; the bundled runtime is Node `v24.19.0`.

## Review Focus

- Blank, placeholder, or Sandbox-style application IDs must allow structural preview where possible but keep live launch blocked.
- Zero, negative, comma-formatted, non-numeric, and more-than-two-decimal amounts must fail without producing a launchable request.
- iPadOS desktop user-agent behavior (`MacIntel` plus touch support) must be recognized as iOS, while Windows must remain launch-blocked.
- Missing, malformed, double-encoded, or non-object callback `data` must render a safe invalid-result state without executing returned content.
- A successful cash/offline callback without `transaction_id` must remain successful and label the server ID unavailable.

---

### Task 1: Square Request Contract

**Files:**
- Create: local Git repository with default branch `main`
- Create: `package.json`
- Create: `site/square-pos.js`
- Create: `test/square-pos.test.mjs`

**Interfaces:**
- Consumes: browser-standard `URL`, `URLSearchParams`, `encodeURIComponent`, and an injected UUID factory
- Produces: `DEFAULT_REQUEST`, `parseAudAmountToMinorUnits(amountText)`, `callbackUrlForPage(pageUrl)`, `createRequestState(uuidFactory)`, `buildSquarePayload(input)`, `buildSquareDeepLink(payload)`, `detectIosDevice(navigatorLike)`, and `validateLaunchReadiness(input)`

- [ ] **Step 1: Initialize the local repository**

Run: `git init -b main`

Expected: an empty local repository on branch `main` inside the deliverable directory.

- [ ] **Step 2: Create the package test command and write failing request-contract tests**

In `package.json`, set the project to ESM and define `test` as `node --test`. In `test/square-pos.test.mjs`, use literal expected values to test:

- `parseAudAmountToMinorUnits("1.00") === "100"` and `"1" === "100"`;
- zero, negative, comma-formatted, non-numeric, and three-decimal inputs throw validation errors;
- `callbackUrlForPage("https://repairs-collab.github.io/square-cash-poc/")` returns the exact Pages callback;
- `createRequestState(() => "fixed-uuid")` returns `aroflo-square-cash-test:fixed-uuid`;
- `buildSquarePayload(...)` returns the exact required object from the spec, including `CASH`, `skip_receipt: false`, and `auto_return: false`;
- decoding `buildSquareDeepLink(payload)` reproduces that exact payload;
- `detectIosDevice` accepts ordinary iOS and iPadOS desktop-mode inputs and rejects Windows;
- `validateLaunchReadiness` rejects blank, `sq0idp-your-production-application-id`, and Sandbox-style IDs, non-HTTPS callbacks, Windows, and invalid amounts.

- [ ] **Step 3: Run the request-contract test and verify RED**

Run: `& $nodeExe --test test/square-pos.test.mjs`

Expected: FAIL because `site/square-pos.js` does not exist or lacks the named exports.

- [ ] **Step 4: Implement the pure Square request module**

Implement the named interfaces in `site/square-pos.js`. Use strict decimal-string parsing rather than floating-point multiplication. `buildSquarePayload(input)` must return only the fields fixed by the spec plus the supplied `client_id`, callback, amount, note, and state. `buildSquareDeepLink(payload)` must return `square-commerce-v1://payment/create?data=` plus one percent-encoded JSON object.

- [ ] **Step 5: Run the request-contract test and verify GREEN**

Run: `& $nodeExe --test test/square-pos.test.mjs`

Expected: all request-contract tests pass with no warnings.

- [ ] **Step 6: Commit the verified request contract**

```powershell
git add package.json site/square-pos.js test/square-pos.test.mjs
git commit -m "feat: add Square cash request contract"
```

### Task 2: Callback Result Contract

**Files:**
- Modify: `site/square-pos.js`
- Create: `test/callback-result.test.mjs`

**Interfaces:**
- Consumes: callback URL string whose `data` query parameter contains Square's iOS JSON response
- Produces: `parseSquareCallback(callbackUrl)` returning `{ kind, status, transactionId, clientTransactionId, errorCode, state, raw, message }`

- [ ] **Step 1: Write failing callback parsing tests**

In `test/callback-result.test.mjs`, use hand-built callback URLs and literal assertions for:

- success with `status: "ok"`, transaction ID, client transaction ID, and state;
- success without `transaction_id`, preserving `kind: "success"` and setting the transaction ID to `null`;
- cancellation with `status: "error"` and `error_code: "payment_canceled"`;
- unknown fields preserved under `raw`;
- missing `data`, malformed percent encoding, malformed JSON, double-encoded JSON, JSON arrays, and JSON scalar values returning `kind: "invalid"` without throwing;
- HTML-like returned strings remaining plain data in the parser result.

- [ ] **Step 2: Run the callback test and verify RED**

Run: `& $nodeExe --test test/callback-result.test.mjs`

Expected: FAIL because `parseSquareCallback` is not exported.

- [ ] **Step 3: Implement defensive callback parsing**

Add `parseSquareCallback(callbackUrl)` to `site/square-pos.js`. Decode at most one extra layer when the first decoded value is still an encoded JSON object, require a non-array object, map documented fields, preserve unknown fields in `raw`, and return an invalid result instead of throwing for all malformed inputs.

- [ ] **Step 4: Run callback and request tests**

Run: `& $nodeExe --test test/callback-result.test.mjs test/square-pos.test.mjs`

Expected: both test files pass with no warnings.

- [ ] **Step 5: Commit callback parsing**

```powershell
git add site/square-pos.js test/callback-result.test.mjs
git commit -m "feat: parse Square POS callback results"
```

### Task 3: Safe Launch and Result Pages

**Files:**
- Create: `site/index.html`
- Create: `site/app.js`
- Create: `site/callback.html`
- Create: `site/callback.js`
- Create: `site/styles.css`
- Create: `server.mjs`
- Create: `start-windows.ps1`
- Create: `test/server.test.mjs`

**Interfaces:**
- Consumes: Task 1 request builders, Task 2 callback parser, browser form events, and HTTP requests for static files
- Produces: `createStaticServer({ rootDirectory })`; launch page controls marked by stable `data-role` attributes; callback page result fields; simulated success and cancellation callback links

- [ ] **Step 1: Write failing static-server behavior tests**

In `test/server.test.mjs`, start `createStaticServer({ rootDirectory })` on an ephemeral port and assert:

- `/` returns the launch page with HTTP 200 and HTML content type;
- `/callback.html` returns HTTP 200 with `Cache-Control: no-store`;
- `/square-pos.js` returns JavaScript content type;
- missing files return 404;
- encoded path traversal attempts return 400 or 404 and never serve files outside `site/`.

- [ ] **Step 2: Run the server test and verify RED**

Run: `& $nodeExe --test test/server.test.mjs`

Expected: FAIL because `server.mjs` and the static pages do not exist.

- [ ] **Step 3: Implement the minimal static server and browser pages**

Implement `createStaticServer({ rootDirectory })` and a direct-run entry point on `127.0.0.1:8787`. Add `start-windows.ps1` to use `node` when available, otherwise use `$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`, open the local URL, and run the server in the foreground. Build the launch page with application ID, amount, reference, derived callback, validation output, decoded payload, deep-link output, live-production confirmation, explicit Square launch button, and simulated success/cancellation links. Persist only the application ID in `localStorage`; invalidate prepared state on every input edit. Keep the launch button disabled unless `validateLaunchReadiness` passes and confirmation is checked. The sole Square navigation statement must be inside the explicit launch click handler.

Build the callback page with no-store browser metadata so `callback.js` calls `parseSquareCallback(window.location.href)` and assigns every returned value with `textContent`. Show status, transaction ID, client transaction ID, state, error code, an explanatory message, raw JSON, and a copy-result button. Label a successful missing transaction ID as unavailable, not failed.

- [ ] **Step 4: Run the server and full unit tests**

Run: `& $nodeExe --test`

Expected: all tests pass; the Node process exits cleanly with no open-handle warnings.

Run a PowerShell parser check against `start-windows.ps1` and verify it reports no syntax errors.

- [ ] **Step 5: Perform local Windows browser checks**

Run: `powershell -ExecutionPolicy Bypass -File .\start-windows.ps1`, then verify:

- no navigation occurs on load or validation;
- default amount and reference are `$1.00` and `AroFlo Square Cash Test`;
- the decoded payload shows `100`, `AUD`, `CASH`, API `1.3`, and `skip_receipt: false`;
- Windows cannot enable the Square launch button;
- simulated success and cancellation callbacks render their documented states safely.

- [ ] **Step 6: Commit the local harness**

```powershell
git add site/index.html site/app.js site/callback.html site/callback.js site/styles.css server.mjs start-windows.ps1 test/server.test.mjs
git commit -m "feat: add safe Square cash test harness"
```

### Task 4: GitHub Pages Packaging and Instructions

**Files:**
- Create: `site/.nojekyll`
- Create: `.github/workflows/test-and-pages.yml`
- Create: `README.md`
- Copy: `docs/superpowers/specs/2026-10-02-square-cash-poc-design.md`
- Copy: `docs/superpowers/plans/2026-10-02-square-cash-poc.md`

**Interfaces:**
- Consumes: verified `site/` artifact and Node test command from Tasks 1–3
- Produces: GitHub Actions test-and-deploy workflow and user instructions for Windows, Square Developer Console, and iPad

- [ ] **Step 1: Add the Pages workflow**

Create `.github/workflows/test-and-pages.yml` triggered by pushes to `main` and manual dispatch. Give it `contents: read`, `pages: write`, and `id-token: write`; run `node --test` on Node 24; upload only `site/` as the Pages artifact; deploy through the official GitHub Pages actions with one production environment.

- [ ] **Step 2: Add exact setup and safety instructions**

Create `README.md` with:

- local Windows command `powershell -ExecutionPolicy Bypass -File .\start-windows.ps1` and `http://127.0.0.1:8787/`;
- public URL and exact callback URL;
- Square Developer Console path: application → Point of Sale API → Web Callback URL;
- application ID placement: the launch page field labelled **Square production application ID** with placeholder `sq0idp-your-production-application-id`;
- explicit warning never to enter an access token, application secret, password, or AroFlo credential;
- PC validation steps, simulated callback steps, and iPad handoff steps;
- production-only warning and guidance to identify or remove the test cash record through normal Square bookkeeping if required;
- troubleshooting for callback mismatch, missing Square app, unsupported API version, canceled payment, and missing transaction ID.

- [ ] **Step 3: Run repository verification**

Run: `& $nodeExe --test`

Run: `git diff --check`

Expected: all tests pass; `git diff --check` produces no output.

- [ ] **Step 4: Commit deployment packaging**

```powershell
git add site/.nojekyll .github/workflows/test-and-pages.yml README.md docs/superpowers
git commit -m "docs: add GitHub Pages deployment guide"
```

### Task 5: Publish and Verify GitHub Pages

**Files:**
- No new source files expected
- External: create and configure `repairs-collab/square-cash-poc`

**Interfaces:**
- Consumes: verified local Git history and the authenticated GitHub account `repairs-collab`
- Produces: public repository, successful Pages deployment, live launch page, and live callback page

- [ ] **Step 1: Create the approved public repository**

Create `repairs-collab/square-cash-poc` as a public repository with default branch `main`. Do not add secrets, tokens, or credentials to repository settings or files.

- [ ] **Step 2: Publish the verified commits**

Set the repository as `origin` and push `main`. If command-line authentication is unavailable, use the connected GitHub repository integration to publish the same verified file tree and commit messages without exposing credentials.

- [ ] **Step 3: Enable and observe GitHub Pages**

Set Pages deployment source to GitHub Actions, wait for `test-and-pages.yml` to complete, and inspect any failure before continuing.

- [ ] **Step 4: Verify the live site and callback simulations**

Open `https://repairs-collab.github.io/square-cash-poc/` and verify defaults, payload validation, launch safeguards, and Windows launch prevention. Open live simulated success and cancellation links and verify the callback page fields and raw JSON. Open `https://repairs-collab.github.io/square-cash-poc/callback.html` without data and verify a safe missing-result message.

- [ ] **Step 5: Re-run local verification against the published commit**

Run: `& $nodeExe --test`

Run: `git status --short`

Expected: all tests pass and the worktree is clean.

- [ ] **Step 6: Prepare the iPad acceptance handoff**

Report the live URL, exact Square callback URL, exact application ID field, production-only warning, and the sequence for validating, confirming, launching, completing/canceling, finishing the receipt screen, and reading returned identifiers. State clearly that the real iPad-to-Square round trip remains unverified until the user performs it with their Square application ID and installed Square Point of Sale app.
