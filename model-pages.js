// Generates the model pricing pages under /docs/models from
// data/model-prices.json: one hub, one page per maker, and one page per model.
import { readFileSync } from "node:fs";
import { formatUsd } from "./format-usd.js";

const INTEGRATIONS = {
  anthropic: "the [Anthropic integration](/integrations/anthropic)",
  openai: "the [OpenAI integration](/integrations/openai)",
  google: "the [Google Gen AI integration](/integrations/google-genai)",
  amazon: "the [Amazon Bedrock integration](/integrations/bedrock)",
};

const GATEWAY_INTEGRATIONS =
  "the [OpenRouter](/integrations/openrouter), [LiteLLM](/integrations/litellm), or [Vercel AI SDK](/integrations/vercel-ai-sdk) integration";

export const modelPagesSource = {
  name: "models",
  prefix: "models",
  staged: true,
  async load() {
    return { entries: entries(), diagnostics: [] };
  },
  async read(ref) {
    return entries().find((entry) => entry.ref === ref)?.raw ?? "";
  },
};

let cached;

function entries() {
  cached ??= modelPageEntries(
    JSON.parse(readFileSync(new URL("./data/model-prices.json", import.meta.url), "utf8")),
  );

  return cached;
}

/**
 * Lowers a price snapshot to Blume source entries. Each maker's pages sit in a
 * `(Maker name)` folder: Blume labels that sidebar group with the exact name
 * and adds no URL segment, so makers and models share one route namespace.
 */
export function modelPageEntries(snapshot) {
  const date = snapshot.fetchedAt.slice(0, 10);
  const makers = Map.groupBy(snapshot.models, (model) => model.maker);
  const routes = [...makers.keys(), ...snapshot.models.map(modelSlug)];
  const duplicate = routes.find((route, index) => routes.indexOf(route) !== index);

  if (duplicate !== undefined) throw new Error(`Two pages share the route /models/${duplicate}`);

  return [
    hubEntry(makers, snapshot, date),
    ...[...makers].flatMap(([maker, models]) => [
      makerEntry(maker, models, date),
      ...newestFirst(models).map((model, index) => modelEntry(model, date, index + 1)),
    ]),
  ];
}

export function modelSlug(model) {
  return model.id.slice(model.id.indexOf("/") + 1).toLowerCase().replaceAll(".", "-");
}

/** The maker's own price, else the lowest input price. */
function referencePrice(model) {
  return model.providers.find((provider) => provider.id === model.maker) ?? model.providers[0];
}

function hubEntry(makers, snapshot, date) {
  const rows = [...makers]
    .map(([maker, models]) => ({ maker, models, newest: newestFirst(models)[0] }))
    .sort((a, b) => b.models.length - a.models.length || a.maker.localeCompare(b.maker))
    .map(
      ({ maker, models, newest }) =>
        `| [${cell(models[0].makerName)}](/models/${maker}) | ${models.length} | [${cell(newest.name)}](/models/${modelSlug(newest)}) |`,
    );

  const body = [
    `This section lists the API prices of ${snapshot.models.length} AI models from ${makers.size} makers. Each model page shows the price per 1M tokens at each provider, the context window, and a cost calculator.`,
    "",
    "telemetry.dev uses the same prices to calculate the cost of each model call in your traces. [Cost calculation](/reference/cost) explains how a price applies to token usage.",
    "",
    "| Maker | Models | Newest model |",
    "| --- | --- | --- |",
    ...rows,
    "",
    sourceLine(date),
  ].join("\n");

  return entry("index.md", {
    title: "Model pricing",
    description: `API prices per 1M tokens for ${snapshot.models.length} AI models, compared across providers.`,
    seo: {
      title: `LLM API pricing: compare ${snapshot.models.length} models across providers`,
      description: `Compare API prices per 1M input and output tokens for ${snapshot.models.length} AI models from OpenAI, Anthropic, Google, and more, at every provider that serves them.`,
    },
    lastModified: date,
  }, body, "md");
}

function makerEntry(maker, models, date) {
  const makerName = models[0].makerName;
  const name = cell(makerName);
  const rows = newestFirst(models).map((model) => {
    const price = referencePrice(model);

    return `| [${cell(model.name)}](/models/${modelSlug(model)}) | ${formatUsd(price.input)} | ${formatUsd(price.output)} | ${model.context ? tokens(model.context) : "—"} | ${model.releaseDate ? cell(model.releaseDate) : "—"} |`;
  });

  const body = [
    `This page lists the API prices of ${models.length} ${name} ${models.length === 1 ? "model" : "models"}, newest first. A price is the ${name} price when ${name} lists the model, else the lowest input price from another provider.`,
    "",
    "| Model | Input per 1M tokens | Output per 1M tokens | Context window | Released |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `## Track ${name} model cost`,
    "",
    `telemetry.dev records the tokens, cost, latency, and errors of each model call in a trace. To send ${name} calls, use ${INTEGRATIONS[maker] ?? GATEWAY_INTEGRATIONS}.`,
    "",
    sourceLine(date),
  ].join("\n");

  return entry(`(${makerName})/${maker}.md`, {
    title: `${makerName} model pricing`,
    description: `API prices per 1M tokens for ${models.length} ${makerName} ${models.length === 1 ? "model" : "models"}.`,
    seo: {
      title: `${makerName} API pricing: ${models.length} ${models.length === 1 ? "model" : "models"} per 1M tokens`,
      description: `Compare API prices per 1M input and output tokens for every ${makerName} model, with context windows and release dates. Each model page has a cost calculator.`,
    },
    sidebar: { label: "All models", order: 0 },
    lastModified: date,
  }, body, "md");
}

function modelEntry(model, date, order) {
  const price = referencePrice(model);
  const firstParty = price.id === model.maker;
  const others = model.providers.length - 1;

  const intro = firstParty
    ? `${cell(model.makerName)} makes ${cell(model.name)}. On the ${cell(price.name)} API, it costs ${formatUsd(price.input)} per 1M input tokens and ${formatUsd(price.output)} per 1M output tokens.`
    : `${cell(model.makerName)} makes ${cell(model.name)}. The lowest input price is ${formatUsd(price.input)} per 1M tokens, at ${cell(price.name)}. ${cell(price.name)} charges ${formatUsd(price.output)} per 1M output tokens.`;

  const body = [
    `${intro} ${others === 0 ? "No other provider lists it." : `${others} other ${others === 1 ? "provider lists" : "providers list"} it.`}`,
    "",
    `## Price per 1M tokens`,
    "",
    `These are the ${cell(price.name)} prices.`,
    "",
    "| Token type | Price per 1M tokens |",
    "| --- | --- |",
    `| Input | ${formatUsd(price.input)} |`,
    `| Output | ${formatUsd(price.output)} |`,
    ...(price.cacheRead === undefined ? [] : [`| Cached input | ${formatUsd(price.cacheRead)} |`]),
    ...(price.cacheWrite === undefined ? [] : [`| Cache write | ${formatUsd(price.cacheWrite)} |`]),
    ...tierLines(price),
    "",
    "## Cost calculator",
    "",
    `Enter your token counts to calculate the ${cell(price.name)} cost. The calculator uses the input and output prices${price.tiers ? " for the lowest context tier" : ""}.`,
    "",
    `<CostCalculator input={${price.input}} output={${price.output}} />`,
    "",
    "## Prices by provider",
    "",
    "Providers are sorted by input price.",
    "",
    "| Provider | Model ID | Input | Output | Cached input |",
    "| --- | --- | --- | --- | --- |",
    ...model.providers.map(
      (provider) =>
        `| ${cell(provider.name)} | ${code(provider.model)} | ${formatUsd(provider.input)} | ${formatUsd(provider.output)} | ${provider.cacheRead === undefined ? "—" : formatUsd(provider.cacheRead)} |`,
    ),
    "",
    "## Specifications",
    "",
    "| Property | Value |",
    "| --- | --- |",
    ...specRows(model).map(([property, value]) => `| ${property} | ${cell(value)} |`),
    "",
    `## Track ${cell(model.name)} cost`,
    "",
    `telemetry.dev records the tokens, cost, latency, and errors of each ${cell(model.name)} call in a trace. To send these calls, use ${INTEGRATIONS[model.maker] ?? GATEWAY_INTEGRATIONS}. [Cost calculation](/reference/cost) explains how the price applies to token usage.`,
    "",
    `See all [${cell(model.makerName)} model prices](/models/${model.maker}) or [every model](/models).`,
    "",
    sourceLine(date),
  ].join("\n");

  return entry(`(${model.makerName})/${modelSlug(model)}.mdx`, {
    title: `${model.name} pricing`,
    description: `${model.name} API prices per 1M tokens, compared across ${model.providers.length} ${model.providers.length === 1 ? "provider" : "providers"}.`,
    seo: {
      title: `${model.name} API pricing: ${formatUsd(price.input)} / ${formatUsd(price.output)} per 1M tokens`,
      description: `${model.name} costs ${formatUsd(price.input)} per 1M input tokens and ${formatUsd(price.output)} per 1M output tokens on ${price.name}. Compare ${model.providers.length} ${model.providers.length === 1 ? "provider" : "providers"} and calculate your cost.`,
    },
    sidebar: { label: model.name, order },
    search: { exclude: true },
    ai: { exclude: true },
    lastModified: date,
  }, body, "mdx");
}

function tierLines(price) {
  if (!price.tiers) return [];

  return [
    "",
    "Long requests cost more. When the input is longer than a threshold, the whole request uses that tier's prices.",
    "",
    "| Input longer than | Input | Output | Cached input |",
    "| --- | --- | --- | --- |",
    ...price.tiers.map(
      (tier) =>
        `| ${tokens(tier.above)} | ${formatUsd(tier.input)} | ${formatUsd(tier.output)} | ${tier.cacheRead === undefined ? "—" : formatUsd(tier.cacheRead)} |`,
    ),
  ];
}

function specRows(model) {
  return [
    ["Maker", model.makerName],
    ["Context window", model.context ? tokens(model.context) : undefined],
    ["Maximum output", model.maxOutput ? tokens(model.maxOutput) : undefined],
    ["Input types", model.inputModalities?.join(", ")],
    ["Output types", model.outputModalities?.join(", ")],
    ["Reasoning", yesNo(model.reasoning)],
    ["Tool calls", yesNo(model.toolCall)],
    ["Open weights", yesNo(model.openWeights)],
    ["Released", model.releaseDate],
    ["Knowledge cutoff", model.knowledge],
  ].filter(([, value]) => value !== undefined);
}

function newestFirst(models) {
  return models.toSorted(
    (a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.name.localeCompare(b.name),
  );
}

function sourceLine(date) {
  return `Prices come from [models.dev](https://models.dev) on ${date}. Providers change their prices, so check the provider's pricing page before you set a budget.`;
}

function tokens(count) {
  return `${count.toLocaleString("en-US")} tokens`;
}

function yesNo(value) {
  return value === undefined ? undefined : value ? "Yes" : "No";
}

// Model and provider names come from models.dev. Escape the characters that
// Markdown, MDX, directives, and tables would otherwise parse. A line break
// would end a table row or start an MDX import, so it becomes a space.
function cell(text) {
  return text.replace(/\s+/g, " ").replace(/[\\`*_{}[\]<>|#:]/g, "\\$&");
}

// A code span is literal text in MDX, but it ends at a backtick run as long as
// its fence, so the fence is one longer than the longest run in the text.
function code(text) {
  const fence = "`".repeat(Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length)) + 1);

  return `${fence} ${text.replace(/\s+/g, " ").replaceAll("|", "\\|")} ${fence}`;
}

function entry(ref, data, body, format) {
  return {
    ref,
    data,
    body: { format, text: body },
    // JSON is valid YAML, so the frontmatter needs no YAML serializer.
    raw: `---\n${JSON.stringify(data)}\n---\n\n${body}\n`,
    lastModified: data.lastModified,
  };
}
