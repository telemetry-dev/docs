<div align="center">

<a href="https://telemetry.dev">
  <img src="public/logo.svg" alt="telemetry.dev" width="96" />
</a>

# telemetry.dev

### See every AI call, tool run, token, and error in one trace.

Observability for AI applications and agents. Trace model calls, inspect tool use, measure cost and latency, and find errors without changing providers.

[Start tracing](https://telemetry.dev) · [Read the docs](https://docs.telemetry.dev)

</div>

![A trace and its spans in the telemetry.dev dashboard](public/dashboard-trace.png)

## Understand what your AI application does

A single request can call a model, run several tools, retry, and call the model again. telemetry.dev joins that work into one trace, so you can see the full path from input to output.

- **Trace complete agent runs.** See model calls, tool executions, retries, and errors in order.
- **Measure usage and cost.** Compare token use, latency, time to first token, and estimated cost.
- **Inspect safely.** Control input and output capture, mask sensitive values, and set content limits.
- **Use your current stack.** Send OpenTelemetry data or install an integration for your provider, framework, or coding agent.

## Start in minutes

Create a project at [telemetry.dev](https://telemetry.dev), copy an API key, and install the SDK.

```sh
npm install @telemetry-dev/sdk
```

```ts
import { init } from "@telemetry-dev/sdk";

const telemetry = init({
  apiKey: process.env.TELEMETRY_DEV_API_KEY,
});
```

The SDK sends traces through OTLP, the OpenTelemetry Protocol. You can also use the Python SDK or an OpenTelemetry exporter.

[Open the quickstart](https://docs.telemetry.dev/quickstart)

## Works with your AI stack

telemetry.dev has integrations for OpenAI, Anthropic, Google Gen AI, Amazon Bedrock, OpenRouter, LiteLLM, the Vercel AI SDK, TanStack AI, MCP, Eve, opencode, Oh My Pi, Pi, Cursor, and OpenClaw.

[See all integrations](https://docs.telemetry.dev/integrations)

## About this repository

This public repository contains the documentation for telemetry.dev. The product source is currently maintained in a private repository.

The site is built from MDX with Blume and hosted as static assets on Cloudflare Workers at [docs.telemetry.dev](https://docs.telemetry.dev). The worker and custom domain are configured in `wrangler.jsonc`.

## Build and deploy

Use the Node.js version in `.node-version` and the pnpm version in `package.json`.
Install dependencies from the committed lockfile, then build and validate the Worker without publishing:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run deploy:check
```

The build produces `dist/`, including the static pages and `404.html`. `pnpm run preview` serves the built site locally.

### Cloudflare Workers Builds

Use Workers Builds for automatic deployment, not a second deployment workflow in GitHub Actions.
Connect `telemetry-dev/docs` to the existing `telemetry-docs` Worker in its current Cloudflare account under **Settings → Builds** with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `pnpm install --frozen-lockfile && pnpm run build` |
| Deploy command | `pnpm dlx wrangler@4.129.0 deploy` |
| Non-production deploy command | `pnpm dlx wrangler@4.129.0 versions upload` |
| Build variable `NODE_VERSION` | `24.20.0` |
| Build variable `PNPM_VERSION` | `11.25.0` |
| Build variable `SKIP_DEPENDENCY_INSTALL` | `true` |

Keep `NODE_VERSION` aligned with `.node-version`, or remove the override once that file is on the production branch.
Skipping the automatic dependency install makes the explicit frozen-lockfile install authoritative.
Install dev dependencies too: Wrangler is pinned there. Keep the Cloudflare-managed deploy token in Workers Builds, never in this repository.

These deploy commands also work before the tooling scripts reach `main`. After merging them, switch to `pnpm run deploy` and `pnpm run deploy:preview` to use the lockfile-pinned Wrangler dependency tree instead of resolving it with `dlx`.
Enable non-production branch builds only if branch previews are wanted; their command uploads a version without promoting it to production.
Wrangler custom-build configuration does not replace the Workers Builds build command.

After a production build, check its commit and deployment status in Cloudflare, then check `/`, `/quickstart`, and a nonexistent path on `https://docs.telemetry.dev` (the missing path must return HTTP 404).

### Manual deployment and rollback

For an authorized manual release, run the install, build, and dry-run commands above, authenticate with `pnpm exec wrangler login`, verify the account with `pnpm exec wrangler whoami`, then run `pnpm run deploy`.
The deploy scripts publish the existing `dist/`; they do not rebuild it.

Inspect releases with `pnpm exec wrangler deployments list`. If a release must be reverted, select a known-good version in the Worker's **Deployments** dashboard or run `pnpm exec wrangler rollback <version-id>` after confirming the target. Rollback changes production immediately; correct the source before the next automatic build.
