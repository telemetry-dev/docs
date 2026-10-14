import { defineConfig } from "blume";
import type { ComponentMarkdown } from "blume";
import { modelPagesSource } from "./model-pages.js";
import { DOCS_BASE_PATH, pageCardMarkdown as serializePageCard } from "./page-card-markdown.js";

const pageCardMarkdown: ComponentMarkdown = serializePageCard;

export default defineConfig({
  title: "telemetry.dev",
  description:
    "Observability for AI apps — every model call, tool step, and agent run in one OpenTelemetry trace, with tokens, cost, latency, and errors.",
  logo: {
    image: "/logo.svg",
    text: "telemetry.dev",
  },
  github: {
    owner: "telemetry-dev",
    repo: "docs",
  },
  content: {
    sources: [
      { type: "filesystem", root: "docs" },
      { type: "custom", source: modelPagesSource },
    ],
  },
  // The model pricing tab keeps its hundreds of pages out of the docs sidebar.
  navigation: {
    tabs: [
      { label: "Documentation", path: "/" },
      { label: "Model pricing", path: "/models" },
    ],
  },
  lastModified: true,
  theme: {
    accent: { light: "#18181b", dark: "#fafafa" },
    radius: "md",
    mode: "system",
  },
  ai: {
    llmsTxt: true,
    markdownComponents: {
      CardGroup: ({ children }) => children,
      Card: pageCardMarkdown,
      // The calculator needs a browser. The price table above it carries the same data.
      CostCalculator: () => "",
      IntegrationCard: pageCardMarkdown,
    },
  },
  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
  },
  deployment: {
    output: "static",
    site: "https://telemetry.dev",
    base: DOCS_BASE_PATH,
  },
});
