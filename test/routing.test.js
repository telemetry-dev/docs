import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createTestHarness } from "wrangler";
import { pageCardHref, pageCardMarkdown } from "../page-card-markdown.js";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
before(() => server.listen());
after(() => server.close());

const integrationMarks = {
  "/docs/integrations/anthropic": "/docs/integrations/anthropic.svg",
  "/docs/integrations/bedrock": "/docs/integrations/aws-bedrock.svg",
  "/docs/integrations/claude-code": "/docs/integrations/claude-code.svg",
  "/docs/integrations/crewai": "/docs/integrations/crewai.svg",
  "/docs/integrations/cursor": "/docs/integrations/cursor.svg",
  "/docs/integrations/eve": "/docs/integrations/eve.svg",
  "/docs/integrations/google-genai": "/docs/integrations/google-genai.svg",
  "/docs/integrations/hermes-agent": "/docs/integrations/hermes-agent.svg",
  "/docs/integrations/langchain-langgraph": "/docs/integrations/langchain.svg",
  "/docs/integrations/litellm": "/docs/integrations/litellm.svg",
  "/docs/integrations/mcp": "/docs/integrations/model-context-protocol.svg",
  "/docs/integrations/omp": "/docs/integrations/oh-my-pi.svg",
  "/docs/integrations/openai": "/docs/integrations/openai.svg",
  "/docs/integrations/openclaw": "/docs/integrations/openclaw.svg",
  "/docs/integrations/opencode": "/docs/integrations/opencode.svg",
  "/docs/integrations/openrouter": "/docs/integrations/openrouter.svg",
  "/docs/integrations/pi": "/docs/integrations/pi.svg",
  "/docs/integrations/pydantic-ai": "/docs/integrations/pydantic-ai.svg",
  "/docs/integrations/tanstack-ai": "/docs/integrations/tanstack-ai.svg",
  "/docs/integrations/vercel-ai-sdk": "/docs/integrations/vercel-ai-sdk.svg",
  "/docs/sdk/opentelemetry": "/docs/integrations/opentelemetry-sdk.svg",
  "/docs/sdk/python": "/docs/integrations/python-sdk.svg",
  "/docs/sdk/typescript": "/docs/integrations/typescript-sdk.svg",
};
const monochromeIntegrationMarks = new Set([
  "anthropic",
  "aws-bedrock",
  "crewai",
  "model-context-protocol",
  "openai",
  "opencode",
  "openrouter",
  "pi",
  "vercel-ai-sdk",
]);

test("page card Markdown follows the component and site base-path contracts", () => {
  for (const [href, expected] of [
    ["/integrations/openai", "/docs/integrations/openai"],
    ["/docs/integrations/openai", "/docs/integrations/openai"],
    ["/docs?source=card", "/docs?source=card"],
    ["/docs2", "/docs/docs2"],
    ["/integrations/model-v2.0?source=card", "/docs/integrations/model-v2.0?source=card"],
    ["https://opentelemetry.io/docs", "https://opentelemetry.io/docs"],
    ["//cdn.example.com/guide", "//cdn.example.com/guide"],
    ["../integrations/openai", "../integrations/openai"],
    ["#model-providers", "#model-providers"],
    ["/?source=card#top", "/docs?source=card#top"],
  ]) {
    assert.equal(pageCardHref(href), expected);
  }

  const props = { href: "/integrations/openai", title: "OpenAI" };
  assert.equal(
    pageCardMarkdown({ children: "Trace calls.", lossy: false, props }),
    "- [OpenAI](/docs/integrations/openai) — Trace calls.",
  );
  assert.equal(pageCardMarkdown({ children: "Trace calls.", lossy: true, props }), null);

  const assetProps = { href: "/integrations/openai.svg?download=1", title: "OpenAI mark" };
  assert.equal(pageCardHref(assetProps.href), "/docs/integrations/openai.svg?download=1");
  assert.equal(
    pageCardMarkdown({ children: "Download the mark.", lossy: false, props: assetProps }),
    "- [OpenAI mark](/docs/integrations/openai.svg?download=1) — Download the mark.",
  );
});

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
  assert.match(
    await css.text(),
    /:root\[data-theme=dark\] \[data-integration-mark-tone=monochrome\] img\{filter:invert\((?:1)?\)\}/,
  );
  const markdown = await server.fetch("/docs/index.md");
  assert.equal(markdown.status, 200);
  assert.match(markdown.headers.get("Content-Type"), /text\/markdown; charset=utf-8/);
  const homeMarkdown = await markdown.text();
  assert.doesNotMatch(homeMarkdown, /<\/?(?:Card|CardGroup|IntegrationCard)\b/);
  assert.ok(
    homeMarkdown.includes(
      "- [Quickstart](/docs/quickstart) — Send a real trace and find it in your project in about five minutes.",
    ),
  );
  const llmsFull = await server.fetch("/docs/llms-full.txt");
  assert.equal(llmsFull.status, 200);
  const llmsFullText = await llmsFull.text();
  assert.doesNotMatch(llmsFullText, /<\/?(?:Card|CardGroup|IntegrationCard)\b/);
  assert.ok(llmsFullText.includes("- [Quickstart](/docs/quickstart) — Send a real trace"));
  const cardAsset = await server.fetch(pageCardHref("/integrations/openai.svg?download=1"));
  assert.equal(cardAsset.status, 200);
  assert.match(cardAsset.headers.get("Content-Type"), /image\/svg\+xml/);
  const missing = await server.fetch("/docs/this-page-does-not-exist");
  assert.equal(missing.status, 404);
});

test("published integration mark URLs remain compatible", async () => {
  for (const [legacy, canonical] of [
    ["gemini.svg", "google-genai.svg"],
    ["omp.svg", "oh-my-pi.svg"],
    ["opentelemetry.svg", "opentelemetry-sdk.svg"],
    ["tanstack.svg", "tanstack-ai.svg"],
  ]) {
    const [legacyAsset, canonicalAsset] = await Promise.all([
      server.fetch(`/docs/integrations/${legacy}`),
      server.fetch(`/docs/integrations/${canonical}`),
    ]);
    assert.equal(legacyAsset.status, 200, `${legacy} must remain available`);
    assert.equal(canonicalAsset.status, 200, `${canonical} must exist`);
    assert.match(legacyAsset.headers.get("Content-Type"), /image\/svg\+xml/);
    assert.equal(await legacyAsset.text(), await canonicalAsset.text());
  }
});

test("the integration catalog and guide-title markup reference available branded marks", async () => {
  const catalog = await server.fetch("/docs/integrations/");
  assert.equal(catalog.status, 200);
  const catalogHtml = await catalog.text();

  for (const [route, mark] of Object.entries(integrationMarks)) {
    const cardStart = catalogHtml.indexOf(`<a data-blume-card="true" href="${route}"`);
    assert.notEqual(cardStart, -1, `${route} must have a catalog card`);
    const markName = mark.slice(mark.lastIndexOf("/") + 1, -".svg".length);
    const cardWrapperStart = catalogHtml.lastIndexOf("<div", cardStart);
    const cardWrapperEnd = catalogHtml.indexOf(">", cardWrapperStart);
    const cardWrapper = catalogHtml.slice(cardWrapperStart, cardWrapperEnd + 1);
    assert.match(
      cardWrapper,
      new RegExp(`(?:^|\\s)data-integration-mark="${markName}"(?=[\\s>])`),
    );
    assert.match(
      catalogHtml.slice(cardWrapperEnd + 1, cardStart),
      /^\s*$/,
      `${route} card must be inside its marked wrapper`,
    );
    assert.equal(
      /(?:^|\s)data-integration-mark-tone="monochrome"(?=[\s>])/.test(cardWrapper),
      monochromeIntegrationMarks.has(markName),
      `${route} card must use the correct dark-mode mark tone`,
    );
    const cardEnd = catalogHtml.indexOf("</a>", cardStart);
    assert.notEqual(cardEnd, -1, `${route} card must close`);
    assert.match(
      catalogHtml.slice(cardEnd + "</a>".length, catalogHtml.indexOf(">", cardEnd + "</a>".length) + 1),
      /^\s*<\/div>$/,
      `${route} marked wrapper must close after the card`,
    );
    assert.ok(
      catalogHtml.slice(cardStart, cardEnd).includes('src="data:image/svg+xml,'),
      `${route} must inline its mark`,
    );

    const asset = await server.fetch(mark);
    assert.equal(asset.status, 200, `${mark} must exist`);
    assert.match(asset.headers.get("Content-Type"), /image\/svg\+xml/);
    const assetSvg = await asset.text();
    const cardHtml = catalogHtml.slice(cardStart, cardEnd);
    const cardImages = cardHtml.match(/<img(?=[\s/>])[^>]*>/g) ?? [];
    assert.equal(cardImages.length, 1, `${route} card must show one mark`);
    const cardImageSrc = cardImages[0].match(/(?:^|\s)src="([^"]+)"(?=[\s>])/)?.[1];
    assert.ok(cardImageSrc?.startsWith("data:image/svg+xml,"));
    assert.equal(
      decodeURIComponent(cardImageSrc.slice("data:image/svg+xml,".length)),
      assetSvg,
      `${route} must inline ${mark}`,
    );

    const guide = await server.fetch(`${route}/`);
    assert.equal(guide.status, 200, `${route} must exist`);
    const guideHtml = await guide.text();
    const titleMarkStarts = [
      ...guideHtml.matchAll(
        /<div(?=[\s/>])(?=[^>]*\sdata-integration-title-mark(?=[\s=>]))[^>]*>/g,
      ),
    ];
    assert.equal(titleMarkStarts.length, 1, `${route} must emit one title-mark container`);
    assert.match(
      titleMarkStarts[0][0],
      new RegExp(`(?:^|\\s)data-integration-mark="${markName}"(?=[\\s>])`),
    );
    assert.equal(
      /(?:^|\s)data-integration-mark-tone="monochrome"(?=[\s>])/.test(titleMarkStarts[0][0]),
      monochromeIntegrationMarks.has(markName),
      `${route} title mark must use the correct dark-mode tone`,
    );
    const titleMarkStart = titleMarkStarts[0].index;
    assert.notEqual(titleMarkStart, undefined);
    const titleMarkEnd = guideHtml.indexOf("</div>", titleMarkStart);
    assert.notEqual(titleMarkEnd, -1, `${route} title-mark container must close`);
    const titleMark = guideHtml.slice(titleMarkStart, titleMarkEnd);
    const titleImages = titleMark.match(/<img(?=[\s/>])[^>]*>/g) ?? [];
    assert.equal(titleImages.length, 1, `${route} must emit one image in the title-mark container`);
    assert.equal(titleImages[0].match(/(?:^|\s)src="([^"]+)"(?=[\s>])/)?.[1], mark);
    const titleMarkCloseEnd = titleMarkEnd + "</div>".length;
    const article = /<article(?=[\s/>])[^>]*>/.exec(guideHtml.slice(titleMarkCloseEnd));
    assert.ok(article, `${route} title mark must precede the article`);
    const articleStart = titleMarkCloseEnd + article.index;
    assert.match(
      guideHtml.slice(titleMarkCloseEnd, articleStart),
      /^\s*$/,
      `${route} title mark must be the article's immediately preceding sibling`,
    );
    const articleContentStart = articleStart + article[0].length;
    assert.match(guideHtml.slice(articleContentStart), /^<h1(?=[\s/>])[^>]*>[^<]+<\/h1>/);
  }

  assert.doesNotMatch(catalogHtml, /(?:^|\s)data-integration-title-mark(?=[\s=>])/);

  const catalogMarkdown = await server.fetch("/docs/integrations.md");
  assert.equal(catalogMarkdown.status, 200);
  const markdown = await catalogMarkdown.text();
  assert.doesNotMatch(markdown, /<\/?(?:CardGroup|IntegrationCard)\b/);
  const cardRoutes = markdown
    .split("\n")
    .filter((line) => line.startsWith("- ["))
    .map((line) => {
      const match = /^- \[[^\]]+\]\(([^)]+)\) — .+$/.exec(line);
      assert.ok(match, `invalid integration card Markdown: ${line}`);
      return match[1];
    });
  assert.deepEqual(cardRoutes.toSorted(), Object.keys(integrationMarks).toSorted());
  assert.ok(
    markdown.includes(
      "- [LangChain and LangGraph](/docs/integrations/langchain-langgraph) — Trace chains, model calls, and tools through OpenTelemetry.",
    ),
  );
  assert.ok(
    markdown.includes(
      "- [OpenAI](/docs/integrations/openai) — Trace OpenAI calls from TypeScript or Python.",
    ),
  );
});

test("modality cross-references in Markdown resolve inside the docs site", async () => {
  for (const [page, label, destination] of [
    ["reference/cost", "modality usage attributes", "reference/span-attributes#modality-token-usage"],
    ["reference/span-attributes", "Cost", "reference/cost#modality-pricing"],
    ["sdk/typescript", "Cost", "reference/cost#modality-pricing"],
    ["sdk/python", "Cost", "reference/cost#modality-pricing"],
  ]) {
    const response = await server.fetch(`/docs/${page}.md`);
    assert.equal(response.status, 200);
    const markdown = await response.text();
    const link = `[${label}](https://telemetry.dev/docs/${destination})`;
    assert.ok(markdown.includes(link), `${page}.md must contain ${link}`);
    const target = new URL(`https://telemetry.dev/docs/${destination}`);
    const linkedResponse = await server.fetch(`${target.pathname}/`);
    assert.equal(linkedResponse.status, 200);
    assert.ok((await linkedResponse.text()).includes(`id="${target.hash.slice(1)}"`));
  }
});
