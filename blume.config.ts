import { defineConfig } from "blume";
import type { ComponentMarkdown } from "blume";
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
  lastModified: true,
  theme: {
    accent: { light: "#18181b", dark: "#fafafa" },
    radius: "md",
    mode: "system",
  },
  markdown: {
    codeBlocks: {
      // github-light colors some tokens below the WCAG AA contrast ratio.
      theme: { light: "github-light-default", dark: "github-dark-default" },
    },
  },
  ai: {
    llmsTxt: true,
    markdownComponents: {
      CardGroup: ({ children }) => children,
      Card: pageCardMarkdown,
      IntegrationCard: pageCardMarkdown,
      Screenshot: ({ lossy, props }) =>
        lossy || typeof props.src !== "string" || typeof props.alt !== "string"
          ? null
          : `![${props.alt}](${DOCS_BASE_PATH}/${props.src})`,
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
