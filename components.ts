import { defineComponents } from "blume";
import CostFigure from "./components/figures/CostFigure.astro";
import PipelineFigure from "./components/figures/PipelineFigure.astro";
import TraceFigure from "./components/figures/TraceFigure.astro";
import IntegrationCard from "./components/IntegrationCard.astro";
import IntegrationTitleMark from "./components/IntegrationTitleMark.astro";
import Screenshot from "./components/Screenshot.astro";

export default defineComponents({
  layout: { PageHeader: IntegrationTitleMark },
  mdx: { CostFigure, IntegrationCard, PipelineFigure, Screenshot, TraceFigure },
});
