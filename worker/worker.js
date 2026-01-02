export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, TRON-PRO-API-KEY",
        },
      });
    }

    if (url.pathname !== "/trc20/transfers") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
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

    return new Response(body, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
