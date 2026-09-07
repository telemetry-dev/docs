export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "docs.telemetry.dev") {
      url.protocol = "https:";
      url.host = "telemetry.dev";
      url.pathname = `/docs${url.pathname}`;
      return Response.redirect(url, 301);
    }

    if (url.pathname !== "/docs" && !url.pathname.startsWith("/docs/")) {
      return fetch(request);
    }

    url.pathname = url.pathname.slice(5) || "/";
    const response = await env.ASSETS.fetch(new Request(url, request));
    const location = response.headers.get("Location");
    if (location) {
      const target = new URL(location, url);
      target.pathname = `/docs${target.pathname}`;
      const redirect = new Response(response.body, response);
      redirect.headers.set("Location", target.href);
      return redirect;
    }
    return response;
  },
};
