import { defineComponents } from "blume";
import IntegrationCard from "./components/IntegrationCard.astro";
import IntegrationTitleMark from "./components/IntegrationTitleMark.astro";

export default defineComponents({
  layout: { PageHeader: IntegrationTitleMark },
  mdx: { IntegrationCard },
});
