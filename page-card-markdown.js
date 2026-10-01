export const DOCS_BASE_PATH = "/docs";

const splitHref = (href) => {
  const path = href.replace(/[#?].*$/u, "");

  return { path, suffix: href.slice(path.length) };
};

const resolvePageHref = (href, { path, suffix }) => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return href;
  }
  if (path === DOCS_BASE_PATH || path.startsWith(`${DOCS_BASE_PATH}/`)) {
    return href;
  }

  return path === "/" ? `${DOCS_BASE_PATH}${suffix}` : `${DOCS_BASE_PATH}${href}`;
};

export const pageCardHref = (href) => resolvePageHref(href, splitHref(href));

export const pageCardMarkdown = ({ children, lossy, props }) => {
  if (lossy || typeof props.href !== "string" || typeof props.title !== "string") {
    return null;
  }

  return `- [${props.title}](${pageCardHref(props.href)}) — ${children}`;
};
