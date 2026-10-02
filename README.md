# Square Cash POS Proof of Concept

A standalone test harness for validating a CASH-only Square Point of Sale mobile-web request before considering any AroFlo integration change.

The harness never connects to AroFlo. It does not use Square access tokens, application secrets, customer details, webhooks, or payment APIs.

## Important safety note

Square Point of Sale does not support Sandbox testing. Completing the iPad handoff can add a real AUD $1.00 cash transaction to the Square account currently signed in on the iPad.

Loading the site and selecting **Validate request** cannot create a transaction. Square can open only after all checks pass, the live-production confirmation is selected, and **Open Square for CASH $1.00** is pressed.

## Addresses

- Test page: <https://repairs-collab.github.io/square-cash-poc/>
- Exact Square callback: <https://repairs-collab.github.io/square-cash-poc/callback.html>
- Local Windows page: <http://127.0.0.1:8787/>

## What you need

- A Square production application with Point of Sale API enabled.
- The application's public Application ID, which normally begins with `sq0idp-`.
- An iPad or iPhone with the current Square Point of Sale app installed and signed in to the intended business location.

Do not enter an access token, application secret, OAuth secret, password, AroFlo credential, or customer information anywhere in this harness. The only Square value it requests is the public Application ID required in the mobile-web deep link.

## 1. Validate safely on Windows

From the repository folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

The script uses a normal Node.js installation when available. Inside Codex Desktop it can also find Codex's bundled Node.js runtime. It opens <http://127.0.0.1:8787/> and keeps the local server running until `Ctrl+C` is pressed.

On the page:

1. Enter the Square Application ID in **Square production application ID**, or leave the visible `sq0idp-your-production-application-id` placeholder for structure-only inspection.
2. Confirm the amount is `$1.00` and the reference is `AroFlo Square Cash Test`.
3. Select **Validate request**.
4. Inspect the decoded JSON. It must show:
   - amount `100`;
   - currency `AUD`;
   - API version `1.3`;
   - tender `CASH` only;
   - `skip_receipt: false`;
   - `auto_return: false`.
5. Confirm that the Square launch button remains disabled on Windows.
6. Use **Simulate success** and **Simulate cancellation** to check the result page without opening Square or creating a transaction.

## 2. Configure Square's callback

In Square Developer Console:

1. Open the production application whose Application ID you will use.
2. Open **Point of Sale API**.
3. In the Web section, set **Web Callback URL** to exactly:

```text
https://repairs-collab.github.io/square-cash-poc/callback.html
```

4. Save the setting.

The callback must match exactly, including `https`, the repository path, and `callback.html`.

## 3. Test the real iPad handoff

1. Open <https://repairs-collab.github.io/square-cash-poc/> on the iPad.
2. Paste the production Application ID into **Square production application ID**.
3. Select **Validate request** and inspect the decoded JSON.
4. Read and select the live-production confirmation.
5. Press **Open Square for CASH $1.00**.
6. In Square Point of Sale, either cancel to test the error callback or complete the $1.00 cash transaction.
7. For a completed payment, finish the digital receipt/Thank You flow and return to the browser.
8. Read the callback status, transaction ID, client transaction ID, state, error code, and complete returned JSON.

The transaction note is `AroFlo Square Cash Test`, making the record easier to identify in Square. If the cash test is completed, handle that record using the business's normal Square bookkeeping procedure so it is not mistaken for customer income.

## Understanding the result

- **Payment completed** means Square returned `status: ok`.
- **Payment canceled** means Square returned `status: error` with `payment_canceled`.
- A missing server transaction ID does not by itself mean failure. Square documents cases where it can be absent for cash or offline processing; the client transaction ID can still be present.
- **No valid Square result** means the callback was opened without data or the returned data could not be decoded.

The result page only displays callback values already present in its URL. It does not retrieve payment details or send the result to AroFlo.

## Troubleshooting

### Square says the callback does not match

Confirm both Square Developer Console and the decoded request use exactly:

```text
https://repairs-collab.github.io/square-cash-poc/callback.html
```

Do not add or remove a trailing slash.

### Square does not open

- Confirm the test is running on iPhone or iPad, not Windows.
- Confirm the current Square Point of Sale app is installed.
- Open Square first and confirm it is signed in to the intended location.
- Return to the test page, validate again, reselect the confirmation, and press the launch button.

### `unsupported_api_version`

Update Square Point of Sale from the App Store. The harness targets Square's documented iOS Point of Sale API version `1.3`.

### `payment_canceled`

This is the expected result when the payment is canceled in Square. No successful payment identifier should be expected.

### Transaction ID is unavailable

Square can omit the server transaction ID for cash or offline processing. Record the callback status, client transaction ID, state, and raw JSON shown by the result page.

## Development

No package installation is required. Run all automated tests with Node.js 24:

```powershell
node --test
```

The GitHub Pages workflow tests the repository before deploying only the static `site/` directory.

## Official Square references

- [Build on Mobile Web](https://developer.squareup.com/docs/pos-api/build-mobile-web)
- [Mobile Web Technical Reference](https://developer.squareup.com/docs/pos-api/web-technical-reference)
- [Point of Sale API overview](https://developer.squareup.com/docs/pos-api/what-it-does)
