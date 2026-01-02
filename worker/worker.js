export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "public, max-age=60",
    };

    const jsonResponse = (status, payload) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(405, { ok: false, status: 405, error: "Method not allowed" });
    }

    if (path === "/health") {
      return jsonResponse(200, { ok: true, hasKey: Boolean(env?.TRONSCAN_API_KEY) });
    }

    if (path === "/") {
      return jsonResponse(200, {
        ok: true,
        message: "ethnova tronscan proxy",
        routes: ["/health", "/trc20/transfers", "/api/token_trc20/transfers"],
      });
    }

    if (!env || !env.TRONSCAN_API_KEY) {
      return jsonResponse(500, {
        ok: false,
        status: 500,
        error: "Missing TRONSCAN_API_KEY secret",
      });
    }

    if (path !== "/trc20/transfers" && path !== "/api/token_trc20/transfers") {
      return jsonResponse(404, { ok: false, status: 404, error: "Not found", path });
    }

    const upstream = new URL("https://apilist.tronscanapi.com/api/token_trc20/transfers");
    upstream.search = url.search;

    const response = await fetch(upstream.toString(), {
      headers: {
        "TRON-PRO-API-KEY": env.TRONSCAN_API_KEY,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      const snippet = body ? body.replace(/\s+/g, " ").slice(0, 500) : "";
      return jsonResponse(response.status, {
        ok: false,
        status: response.status,
        error: "Upstream error",
        upstreamSnippet: snippet,
      });
    }

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
