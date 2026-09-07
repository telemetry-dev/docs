import { defineConfig } from "blume";

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
  ai: {
    llmsTxt: true,
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
    base: "/docs",
  },
});
