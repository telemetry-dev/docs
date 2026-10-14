import assert from "node:assert/strict";
import { test } from "node:test";
import { modelPageEntries } from "../model-pages.js";
import { buildSnapshot } from "../scripts/update-model-prices.js";

const price = (input, output) => ({ input, output });

// A trimmed models.dev catalog: makers list their own models without a
// canonical ID, and hosts name the same model in their own ways.
const api = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: {
      "claude-sonnet-4-5": { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (latest)", cost: price(3, 15) },
      "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", cost: price(3, 15) },
    },
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    models: { "gpt-5.3-codex-spark": { id: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark", cost: price(1.75, 14) } },
  },
  vivgrid: {
    id: "vivgrid",
    name: "Vivgrid",
    models: {
      "vivgrid-chat": { id: "vivgrid-chat", name: "Vivgrid Chat", canonical_model_id: "vivgrid/vivgrid-chat", cost: price(1, 2) },
      // OpenAI's model, resold under Vivgrid's own provider ID.
      "gpt-5.4": { id: "gpt-5.4", name: "GPT-5.4", cost: price(2.5, 15) },
    },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    models: {
      "anthropic/claude-sonnet-4.5": {
        id: "anthropic/claude-sonnet-4.5",
        name: "Anthropic: Claude Sonnet 4.5",
        canonical_model_id: "anthropic/claude-sonnet-4-5",
        cost: price(3, 15),
      },
      "anthropic/claude-sonnet-4.5:free": {
        id: "anthropic/claude-sonnet-4.5:free",
        name: "Anthropic: Claude Sonnet 4.5 (free)",
        canonical_model_id: "anthropic/claude-sonnet-4-5",
        cost: price(0, 0),
      },
      "aion-labs/aion-2.0": {
        id: "aion-labs/aion-2.0",
        name: "AionLabs: Aion-2.0",
        canonical_model_id: "aion-labs/aion-2.0",
        cost: price(0.8, 1.6),
      },
      "openai/gpt-5.4": {
        id: "openai/gpt-5.4",
        name: "OpenAI: GPT-5.4",
        canonical_model_id: "openai/gpt-5.4",
        cost: price(2.5, 15),
      },
      "evil/model": {
        id: "evil/model",
        name: "Evil",
        canonical_model_id: "evil/model) [x](javascript:alert(1)",
        cost: price(1, 1),
      },
    },
  },
  cortecs: {
    id: "cortecs",
    name: "Cortecs",
    models: {
      "claude-sonnet-4": {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        canonical_model_id: "anthropic/claude-sonnet-4-20250514",
        cost: price(2.9, 14),
      },
    },
  },
  requesty: {
    id: "requesty",
    name: "Requesty",
    models: {
      "claude-sonnet-4@eu": {
        id: "claude-sonnet-4@eu",
        name: "Claude Sonnet 4 (latest) (EU)",
        canonical_model_id: "anthropic/claude-sonnet-4-0",
        cost: price(3.3, 16.5),
      },
    },
  },
  "sap-ai-core": {
    id: "sap-ai-core",
    name: "SAP AI Core",
    models: {
      "anthropic--claude-3.5-sonnet": {
        id: "anthropic--claude-3.5-sonnet",
        name: "anthropic--claude-3.5-sonnet",
        canonical_model_id: "anthropic/claude-3-5-sonnet-20241022",
        cost: price(3, 15),
      },
    },
  },
  stepfun: {
    id: "stepfun",
    name: "StepFun (China)",
    models: { "step-3": { id: "step-3", name: "Step 3", canonical_model_id: "stepfun/step-3", cost: price(0.5, 1.5) } },
  },
};

test("the snapshot gives each model one page with every paid provider", () => {
  const { models } = buildSnapshot(api, "2026-10-14T00:00:00.000Z");

  assert.deepEqual(
    models.map((model) => [model.id, model.providers.map((provider) => provider.id)]),
    [
      ["aion-labs/aion-2.0", ["openrouter"]],
      ["anthropic/claude-3-5-sonnet-20241022", ["sap-ai-core"]],
      // The EU alias joins the maker's own Claude Sonnet 4 page.
      ["anthropic/claude-sonnet-4-20250514", ["cortecs", "anthropic", "requesty"]],
      ["anthropic/claude-sonnet-4-5", ["anthropic", "openrouter"]],
      ["openai/gpt-5.3-codex-spark", ["openai"]],
      ["openai/gpt-5.4", ["openrouter"]],
      ["stepfun/step-3", ["stepfun"]],
      ["vivgrid/vivgrid-chat", ["vivgrid"]],
    ],
  );
});

test("the snapshot names models and makers without host tags", () => {
  const { models } = buildSnapshot(api, "2026-10-14T00:00:00.000Z");

  assert.deepEqual(
    models.map((model) => [model.name, model.makerName]),
    [
      ["Aion-2.0", "AionLabs"],
      ["claude-3-5-sonnet-20241022", "Anthropic"],
      ["Claude Sonnet 4", "Anthropic"],
      ["Claude Sonnet 4.5", "Anthropic"],
      ["GPT-5.3 Codex Spark", "OpenAI"],
      ["GPT-5.4", "OpenAI"],
      ["Step 3", "StepFun"],
      ["Vivgrid Chat", "Vivgrid"],
    ],
  );
});

test("model pages reject two pages on one route", () => {
  const model = (id) => ({ id, name: id, maker: id.split("/")[0], makerName: id, providers: [{ id: "host", name: "Host", input: 1, output: 2 }] });

  assert.throws(
    () => modelPageEntries({ fetchedAt: "2026-10-14T00:00:00.000Z", models: [model("alpha/chat"), model("beta/chat")] }),
    /share the route \/models\/chat/,
  );
  assert.throws(
    () => modelPageEntries({ fetchedAt: "2026-10-14T00:00:00.000Z", models: [model("alpha/beta"), model("beta/chat")] }),
    /share the route \/models\/beta/,
  );
});

test("model pages keep catalog text out of Markdown and MDX syntax", () => {
  const entries = modelPageEntries({
    fetchedAt: "2026-10-14T00:00:00.000Z",
    models: [
      {
        id: "evil/chat",
        name: 'Chat\n\nimport fs from "node:fs"\n\n{process.exit(1)}',
        maker: "evil",
        makerName: "Evil <img src=x onerror=alert(1)>",
        releaseDate: "{1}",
        providers: [{ id: "host", name: "Host", model: "a`{1}`b|c", input: 1, output: 2 }],
      },
    ],
  });
  const pages = entries.map((entry) => entry.body.text).join("\n");

  assert.doesNotMatch(pages, /^(?:import|export)\b/m);
  assert.ok(pages.includes('Chat import fs from "node\\:fs" \\{process.exit(1)\\}'));
  assert.ok(pages.includes("Evil \\<img src=x onerror=alert(1)\\>"));
  assert.ok(pages.includes("| Released | \\{1\\} |"));
  assert.ok(pages.includes("| Host | `` a`{1}`b\\|c `` |"));
});
