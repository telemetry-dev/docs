import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createTestHarness } from "wrangler";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
before(() => server.listen());
after(() => server.close());

test("HTML redirects stay inside the docs path", async () => {
  for (const path of ["/docs", "/docs/sdk/python"]) {
    const response = await server.fetch(`${path}?source=bookmark`, { redirect: "manual" });
    assert.equal(response.status, 307);
    const target = new URL(response.headers.get("Location"), "https://telemetry.dev");
    assert.equal(target.pathname, `${path}/`);
    assert.equal(target.search, "?source=bookmark");
  }
});

test("docs pages and their assets load under the mount path", async () => {
  const response = await server.fetch("/docs/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="https:\/\/telemetry\.dev\/docs"/);
  const style = html.match(/<link rel="stylesheet" href="([^"]+)"/);
  assert.ok(style);
  assert.ok(style[1].startsWith("/docs/"));
  const css = await server.fetch(style[1]);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("Content-Type"), /text\/css/);
  const markdown = await server.fetch("/docs/index.md");
  assert.equal(markdown.status, 200);
  assert.match(markdown.headers.get("Content-Type"), /text\/markdown; charset=utf-8/);
  const missing = await server.fetch("/docs/this-page-does-not-exist");
  assert.equal(missing.status, 404);
});
