// Shared by the figure components and their Markdown serializers in blume.config.ts,
// so the rendered figure and the llms.txt / .md text cannot disagree.

export const SPAN_TYPES = {
  agent: "Agent",
  generation: "Chat",
  tool: "Tool",
  span: "Function",
  embedding: "Embeddings",
  retrieval: "Retrieval",
};

const integer = new Intl.NumberFormat("en-US");

export const formatTokens = (value) => integer.format(value);

export const formatUsd = (value) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 8, minimumFractionDigits: 2 })}`;

export const formatPrice = (value) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;

// Same unit and rounding as the dashboard waterfall, so figure labels read like the product.
export const formatMs = (value) => {
  const digits = value < 1 ? 2 : value < 10 ? 1 : 0;
  return `${Number.parseFloat(value.toFixed(digits))}ms`;
};

/** The dashboard's "nice" tick steps (1/2/5 × 10^n ms) for a timeline of about `widthPx`. */
export const buildTicks = (totalMs, widthPx = 244) => {
  const fits = Math.floor((widthPx - 48) / 80);
  const target = fits >= 6 ? 6 : fits >= 4 ? 4 : 2;
  const raw = totalMs / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let value = 0; value <= totalMs * 0.999 && ticks.length <= 12; value += step)
    ticks.push({ percent: (value / totalMs) * 100, label: formatMs(value) });
  return ticks;
};

/**
 * Splits a span's usage into the parts the ingest server prices separately.
 * Prices are US dollars per 1,000,000 tokens; a missing cache price falls back to `input`,
 * matching apps/ingest/src/pricing.ts.
 */
export const costParts = ({ input, cacheRead = 0, cacheWrite = 0, output, prices }) => {
  const parts = [
    { key: "uncached", label: "Uncached input", tokens: Math.max(0, input - cacheRead - cacheWrite), price: prices.input },
    { key: "cacheRead", label: "Cache read", tokens: cacheRead, price: prices.cachedInput ?? prices.input },
    { key: "cacheWrite", label: "Cache creation", tokens: cacheWrite, price: prices.cacheWrite ?? prices.input },
    { key: "output", label: "Output", tokens: output, price: prices.output },
  ].filter((part) => part.tokens > 0);

  // Work in micro-dollars so the total is exact for the prices the docs use.
  for (const part of parts) part.microUsd = part.tokens * part.price;
  const totalMicroUsd = parts.reduce((sum, part) => sum + part.microUsd, 0);
  const totalTokens = parts.reduce((sum, part) => sum + part.tokens, 0);

  return {
    parts: parts.map((part) => ({ ...part, usd: Number((part.microUsd / 1_000_000).toFixed(8)) })),
    totalTokens,
    totalUsd: Number((totalMicroUsd / 1_000_000).toFixed(8)),
  };
};

export const costMarkdown = ({ lossy, props }) => {
  if (lossy) return null;
  const { parts, totalTokens, totalUsd } = costParts(props);
  const rows = parts.map(
    (part) =>
      `| ${part.label} | ${formatTokens(part.tokens)} | ${formatPrice(part.price)} | ${formatUsd(part.usd)} |`,
  );
  return [
    "| Token part | Tokens | Price per 1M tokens | Cost |",
    "| --- | ---: | ---: | ---: |",
    ...rows,
    `| **Total** | ${formatTokens(totalTokens)} | | **${formatUsd(totalUsd)}** |`,
  ].join("\n");
};

export const traceMarkdown = ({ lossy, props }) => {
  if (lossy || !Array.isArray(props.spans)) return null;
  const lines = props.spans.map((span) => {
    const operation = span.operation ? `, ${span.operation}` : "";
    const status = span.error ? ", error" : "";
    return `${"  ".repeat(span.depth ?? 0)}- \`${span.name}\` (${SPAN_TYPES[span.type]}${operation}, ${formatMs(span.end - span.start)}${status})`;
  });
  return [props.title ? `${props.title}:` : "", "", ...lines].join("\n").trim();
};

export const PIPELINE = {
  app: {
    title: "Your application",
    detail: "An SDK or OpenTelemetry exporter records spans, logs, and metrics.",
    privacy: "Capture flags and `mask` change or drop content before it leaves the process.",
  },
  transport: "OTLP/HTTP with a project API key",
  ingest: [
    { title: "Authenticate", detail: "The API key selects the project." },
    { title: "Check environment", detail: "An environment-scoped key rejects data from other environments." },
    {
      title: "Normalize",
      detail: "Map attributes to model, tokens, and content. Calculate cost.",
      privacy: "Apply the environment's capture setting, built-in redaction, and custom patterns.",
    },
    { title: "Check quota", detail: "Count the batch against the plan's monthly allowance." },
  ],
  store: {
    title: "Storage",
    detail: "Traces, logs, and metrics are written for the dashboard.",
    privacy: "Data older than the project's retention period is removed.",
  },
};

export const pipelineMarkdown = ({ lossy, props }) => {
  if (lossy) return null;
  const privacy = props.focus === "privacy";
  const note = (stage) => (privacy && stage.privacy ? ` Privacy: ${stage.privacy}` : "");
  return [
    `1. **${PIPELINE.app.title}.** ${PIPELINE.app.detail}${note(PIPELINE.app)}`,
    `2. **Send.** ${PIPELINE.transport}.`,
    ...PIPELINE.ingest.map(
      (stage, index) => `${index + 3}. **Ingest: ${stage.title}.** ${stage.detail}${note(stage)}`,
    ),
    `${PIPELINE.ingest.length + 3}. **${PIPELINE.store.title}.** ${PIPELINE.store.detail}${note(PIPELINE.store)}`,
  ].join("\n");
};
