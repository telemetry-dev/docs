// Static assets answer a Range request with the whole file, and Safari and iOS do not play an MP4
// served that way. wrangler.jsonc runs this Worker first only for /docs/recordings/*, so it can
// answer byte ranges there; every other request is served by the assets as before.
const RANGE = /^bytes=(\d*)-(\d*)$/;

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith("/docs/recordings/")) return env.ASSETS.fetch(request);

    // The assets still answer the method, redirects, and If-None-Match; only Range is handled here.
    const assetHeaders = new Headers(request.headers);
    assetHeaders.delete("Range");
    const full = await env.ASSETS.fetch(new Request(request, { headers: assetHeaders }));
    if (full.status !== 200) return full;
    const headers = new Headers(full.headers);
    headers.set("Accept-Ranges", "bytes");

    // RFC 9110 lets the server answer a HEAD, or a multiple or malformed range, with the whole
    // file. It must do so when If-Range names an older version, or the client would join the bytes
    // of two versions.
    const match = RANGE.exec(request.headers.get("Range") ?? "");
    const ifRange = request.headers.get("If-Range");
    if (
      request.method === "HEAD" ||
      !match ||
      (match[1] === "" && match[2] === "") ||
      (ifRange !== null && ifRange !== full.headers.get("ETag"))
    ) {
      return new Response(full.body, { status: 200, headers });
    }
    headers.delete("Content-Length");

    const body = await full.arrayBuffer();
    const size = body.byteLength;
    const [start, end] =
      match[1] === ""
        ? [Math.max(size - Number(match[2]), 0), size - 1]
        : [Number(match[1]), match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1)];

    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
