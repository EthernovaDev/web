export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "public, max-age=60",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname !== "/trc20/transfers") {
      return new Response(JSON.stringify({ ok: false, status: 404, error: "Not found" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
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
      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          error: "Upstream error",
          upstreamSnippet: snippet,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
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
