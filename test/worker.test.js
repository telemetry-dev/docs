import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { unstable_dev } from "wrangler";
import worker from "../worker.js";

let server;
before(async () => {
  server = await unstable_dev("worker.js", {
    config: "wrangler.jsonc",
    local: true,
    ip: "127.0.0.1",
    port: 0,
    inspectorPort: 0,
    logLevel: "error",
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
  });
});
after(async () => server?.stop());

test("old docs URLs keep their page and query string", async () => {
  const response = await worker.fetch(
    new Request("https://docs.telemetry.dev/sdk/python?source=bookmark"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("Location"),
    "https://telemetry.dev/docs/sdk/python?source=bookmark",
  );
});

test("HTML redirects stay inside the docs path", async () => {
  const response = await server.fetch("/docs/sdk/python?source=bookmark", {
    redirect: "manual",
  });
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("Location"));
  assert.equal(target.pathname, "/docs/sdk/python/");
  assert.equal(target.search, "?source=bookmark");
});

test("docs pages and their assets load under the mount path", async () => {
  const response = await server.fetch("/docs");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="https:\/\/telemetry\.dev\/docs"/);
  const style = html.match(/<link rel="stylesheet" href="([^"]+)"/);
  assert.ok(style);
  assert.ok(style[1].startsWith("/docs/"));
  const css = await server.fetch(style[1]);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("Content-Type"), /text\/css/);
  const missing = await server.fetch("/docs/this-page-does-not-exist");
  assert.equal(missing.status, 404);
});
