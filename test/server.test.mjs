import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { createStaticServer } from "../server.mjs";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const siteDirectory = path.join(projectDirectory, "site");

async function withServer(run) {
  const server = createStaticServer({ rootDirectory: siteDirectory });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("serves the launch page and Square module with correct content types", async () => {
  await withServer(async (baseUrl) => {
    const pageResponse = await fetch(`${baseUrl}/`);
    const moduleResponse = await fetch(`${baseUrl}/square-pos.js`);

    assert.equal(pageResponse.status, 200);
    assert.match(pageResponse.headers.get("content-type"), /^text\/html/);
    assert.match(await pageResponse.text(), /Square Cash Test/);
    assert.equal(moduleResponse.status, 200);
    assert.match(
      moduleResponse.headers.get("content-type"),
      /^text\/javascript/,
    );
  });
});

test("keeps the proof-of-concept amount fixed at AUD $1.00", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.match(
      html,
      /data-role="amount"[\s\S]*?value="1\.00"[\s\S]*?readonly/,
    );
    assert.match(html, /Amount is fixed for this proof of concept\./);
  });
});

test("serves the callback page without browser caching", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/callback.html`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(
      html,
      /does not\s+persist or forward them after reading the callback URL/,
    );
  });
});

test("returns 404 for missing files", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing-file.txt`);
    assert.equal(response.status, 404);
  });
});

test("blocks encoded path traversal outside the site directory", async () => {
  await withServer(async (baseUrl) => {
    for (const pathAttempt of [
      "/..%2Fpackage.json",
      "/%2e%2e%2Fpackage.json",
      "/%252e%252e%252fpackage.json",
    ]) {
      const response = await fetch(`${baseUrl}${pathAttempt}`);
      assert.ok(
        response.status === 400 || response.status === 404,
        `${pathAttempt}: ${response.status}`,
      );
      assert.doesNotMatch(await response.text(), /"name": "square-cash-poc"/);
    }
  });
});
