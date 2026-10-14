// Refreshes data/model-prices.json from models.dev, the primary price catalog
// of the telemetry.dev cost calculation. Run with `pnpm models:update`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = "https://models.dev/api.json";
const OUTPUT = new URL("../data/model-prices.json", import.meta.url);

const DATE_SUFFIX = /-(?:\d{8}|\d{4}-\d{2}-\d{2})$/;

// A model ID becomes a page route and a link target.
const MODEL_ID = /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/;

// Alias and region tags, as in "Claude Sonnet 4 (latest) (EU)", do not name
// a different model.
const ALIAS_TAGS = /(?: \((?:latest|EU|US|Global|APAC|JP|AU|India)\))+$/;

// Names for makers without a models.dev provider entry of their own.
const MAKER_NAMES = {
  "aion-labs": "AionLabs",
  aisingapore: "AI Singapore",
  amazon: "Amazon",
  "anthracite-org": "Anthracite",
  "arcee-ai": "Arcee AI",
  baai: "BAAI",
  baichuan: "Baichuan",
  baidu: "Baidu",
  "bytedance-seed": "ByteDance Seed",
  cognitivecomputations: "Cognitive Computations",
  deepreinforce: "DeepReinforce",
  gryphe: "Gryphe",
  ibm: "IBM",
  inclusionai: "inclusionAI",
  "inference-net": "Inference.net",
  mancer: "Mancer",
  meituan: "Meituan",
  microsoft: "Microsoft",
  mindlab: "Mind Lab",
  mixedbread: "Mixedbread",
  "motif-technologies": "Motif Technologies",
  "nex-agi": "Nex AGI",
  nousresearch: "Nous Research",
  openbmb: "OpenBMB",
  paddlepaddle: "PaddlePaddle",
  perceptron: "Perceptron",
  quiverai: "QuiverAI",
  rekaai: "Reka AI",
  relace: "Relace",
  sao10k: "Sao10K",
  "swiss-ai": "Swiss AI",
  tencent: "Tencent",
  thedrummer: "TheDrummer",
  trendyol: "Trendyol",
  unbiased: "Unbiased",
  undi95: "Undi95",
  writer: "Writer",
};

/**
 * Groups every priced models.dev entry by its canonical `maker/model` ID.
 * Makers often list their own models without a canonical ID, so a maker's
 * `gpt-4o` entry joins `openai/gpt-4o`. A dated ID joins its undated model.
 * A maker's entry that no host maps gets a page of its own, unless another
 * maker has a model of that name: Vivgrid makes models but also resells
 * OpenAI's `gpt-5.4` under its own provider ID.
 * Each provider keeps one entry per model: the entry whose ID equals the
 * canonical model name, else the shortest ID (dated IDs are usually longer).
 * Subscription plans list their models at $0, so entries priced at zero for
 * both input and output are left out.
 */
export function buildSnapshot(api, fetchedAt) {
  const canonicalIds = new Set();

  for (const provider of Object.values(api)) {
    for (const entry of Object.values(provider.models ?? {})) {
      if (typeof entry.canonical_model_id === "string") canonicalIds.add(entry.canonical_model_id);
    }
  }

  const makers = new Set([...canonicalIds].map(makerOf));
  const modelNames = new Set([...canonicalIds].map((id) => id.slice(id.indexOf("/") + 1)));
  const groups = new Map();

  for (const provider of Object.values(api)) {
    for (const entry of Object.values(provider.models ?? {})) {
      const cost = entry.cost;

      if (!Number.isFinite(cost?.input) || !Number.isFinite(cost?.output) || (cost.input === 0 && cost.output === 0)) {
        continue;
      }

      const ownId = entry.canonical_model_id ?? `${provider.id}/${entry.id}`;
      const undated = ownId.replace(DATE_SUFFIX, "");
      const id = canonicalIds.has(undated) ? undated : ownId;
      const firstParty = makers.has(provider.id) && !modelNames.has(entry.id);

      if (!MODEL_ID.test(id) || !(canonicalIds.has(id) || firstParty)) continue;

      const group = groups.get(id) ?? [];
      group.push({ provider, entry });
      groups.set(id, group);
    }
  }

  // Two IDs can name one model, such as `mistral-large` and
  // `mistral-large-latest`. They share one page under the ID that the maker
  // lists, else the ID with more providers, else the shorter ID.
  const byName = new Map();

  for (const [id, group] of groups) {
    const maker = makerOf(id);
    const key = `${maker}|${modelDisplayName(id, entriesByProvider(id, group).get(maker), group).toLowerCase()}`;
    const other = byName.get(key);
    const keep = other === undefined || preferGroup({ id, group }, other) ? id : other.id;

    byName.set(key, { id: keep, group: [...(other?.group ?? []), ...group] });
  }

  const models = [...byName.values()].map(({ id, group }) => {
    const maker = makerOf(id);
    const byProvider = entriesByProvider(id, group);
    const firstParty = byProvider.get(maker);
    const spec =
      firstParty ??
      group.reduce((best, item) =>
        (item.entry.limit?.context ?? 0) > (best.entry.limit?.context ?? 0) ? item : best,
      );

    return {
      id,
      name: modelDisplayName(id, firstParty, group),
      maker,
      // Strips a region from a provider name, as in "StepFun (China)".
      makerName: MAKER_NAMES[maker] ?? api[maker]?.name.replace(/ \(.*\)$/, "") ?? maker,
      releaseDate: spec.entry.release_date ?? group.find((item) => item.entry.release_date)?.entry.release_date,
      knowledge: spec.entry.knowledge ?? group.find((item) => item.entry.knowledge)?.entry.knowledge,
      context: spec.entry.limit?.context,
      maxOutput: spec.entry.limit?.output,
      inputModalities: spec.entry.modalities?.input,
      outputModalities: spec.entry.modalities?.output,
      reasoning: spec.entry.reasoning,
      toolCall: spec.entry.tool_call,
      openWeights: spec.entry.open_weights,
      providers: [...byProvider.values()]
        .map(({ provider, entry }) => providerPrice(provider, entry))
        .sort((a, b) => a.input - b.input || a.output - b.output || a.id.localeCompare(b.id)),
    };
  });

  models.sort((a, b) => a.id.localeCompare(b.id));

  return { source: SOURCE, fetchedAt, models };
}

function makerOf(id) {
  return id.slice(0, id.indexOf("/"));
}

function entriesByProvider(id, group) {
  const modelName = id.slice(id.indexOf("/") + 1);
  const byProvider = new Map();

  for (const item of group) {
    const current = byProvider.get(item.provider.id);
    if (current === undefined || preferEntry(item.entry, current.entry, modelName)) {
      byProvider.set(item.provider.id, item);
    }
  }

  return byProvider;
}

function preferEntry(candidate, current, modelName) {
  if ((current.id === modelName) !== (candidate.id === modelName)) return candidate.id === modelName;

  return candidate.id.length < current.id.length || (candidate.id.length === current.id.length && candidate.id < current.id);
}

function preferGroup(candidate, current) {
  const listedByMaker = ({ id, group }) => group.some((item) => item.provider.id === makerOf(id));

  if (listedByMaker(candidate) !== listedByMaker(current)) return listedByMaker(candidate);
  if (candidate.group.length !== current.group.length) return candidate.group.length > current.group.length;

  return candidate.id.length < current.id.length;
}

// The first-party name wins. Else the most common host name wins, and names
// without a host suffix such as "(Cerebras)" come first. A host that uses its
// model ID as the name, such as SAP AI Core, does not count. OpenRouter puts
// the maker in front, as in "AionLabs: Aion-2.0".
function modelDisplayName(id, firstParty, group) {
  if (firstParty !== undefined) return firstParty.entry.name.replace(ALIAS_TAGS, "");

  const counts = new Map();

  for (const { entry } of group) {
    if (entry.name === entry.id) continue;

    const name = entry.name.replace(/^[^:]+: /, "").replace(ALIAS_TAGS, "");
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const [best] = [...counts].sort(
    ([a, countA], [b, countB]) =>
      Number(a.includes("(")) - Number(b.includes("(")) || countB - countA || a.length - b.length || a.localeCompare(b),
  );

  return best?.[0] ?? id.slice(id.indexOf("/") + 1);
}

function providerPrice(provider, entry) {
  const { cost } = entry;
  // models.dev lists context tiers in `tiers`; the older `context_over_200k`
  // field applies only when `tiers` is absent.
  const tiers =
    cost.tiers
      ?.filter((tier) => tier.tier?.type === "context")
      .map((tier) => ({ above: tier.tier.size, input: tier.input, output: tier.output, cacheRead: tier.cache_read })) ??
    (cost.context_over_200k
      ? [{ above: 200_000, input: cost.context_over_200k.input, output: cost.context_over_200k.output, cacheRead: cost.context_over_200k.cache_read }]
      : undefined);

  return {
    id: provider.id,
    name: provider.name,
    model: entry.id,
    input: cost.input,
    output: cost.output,
    cacheRead: cost.cache_read,
    cacheWrite: cost.cache_write,
    tiers,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const response = await fetch(SOURCE, { signal: AbortSignal.timeout(60_000) });

  if (!response.ok) throw new Error(`${SOURCE} returned ${response.status}`);

  const snapshot = buildSnapshot(await response.json(), new Date().toISOString());

  if (snapshot.models.length === 0) throw new Error(`${SOURCE} returned no priced models`);

  writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(`Wrote ${snapshot.models.length} models to ${fileURLToPath(OUTPUT)}`);
}
