const FALLBACK_CONFIG = {
  TRON_ADDRESS: "TVYT4XtYtnBEg5VnKNUnx1n8oUeZ8mq2Lg",
  USDT_CONTRACT_TRON: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
  API_BASE: "https://apilist.tronscanapi.com",
  PROXY_BASE: "",
  TRANSFERS_PATH: "/api/token_trc20/transfers",
  FALLBACK_PATH: "/api/token_trc20/transfers",
  PROXY_TRANSFERS_PATH: "/trc20/transfers",
  PRIMARY_QUERY_MODE: "related",
  FALLBACK_QUERY_MODE: "address",
  FALLBACK_CONFIRM: false,
  MAX_TX_SCAN: 500,
  TRONSCAN_WALLET_URL: "https://tronscan.org/#/address/{ADDRESS}",
  TRONSCAN_TX_URL: "https://tronscan.org/#/transaction/{TX}",
};

const CONFIG = typeof window !== "undefined" && window.FUNDRAISER_CONFIG
  ? window.FUNDRAISER_CONFIG
  : FALLBACK_CONFIG;

const $ = (id) => document.getElementById(id);

const elements = {
  directUrl: $("directUrl"),
  proxyUrl: $("proxyUrl"),
  btnFetchDirect: $("btnFetchDirect"),
  btnFetchProxy: $("btnFetchProxy"),
  btnTestProxy: $("btnTestProxy"),
  fetchStatus: $("fetchStatus"),
  fetchSource: $("fetchSource"),
  rawJson: $("rawJson"),
  attemptLog: $("attemptLog"),
  txSearch: $("txSearch"),
  btnSearch: $("btnSearch"),
  searchResult: $("searchResult"),
};

const state = {
  transfers: [],
  payload: null,
  attempts: [],
  source: "-",
  status: "-",
};

function sanitizeBase(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function apiBase(base) {
  return sanitizeBase(base);
}

function createTransferUrl(base, start, limit, options = {}) {
  const normalizedBase = apiBase(base);
  const params = new URLSearchParams({
    limit: String(limit),
    start: String(start),
    contract_address: CONFIG.USDT_CONTRACT_TRON,
    _: String(Date.now()),
  });
  const mode = options.mode || CONFIG.PRIMARY_QUERY_MODE;
  if (mode === "address") {
    params.set("address", CONFIG.TRON_ADDRESS);
  } else {
    params.set("relatedAddress", CONFIG.TRON_ADDRESS);
  }
  if (options.confirm !== false) {
    params.set("confirm", "true");
  }
  const path = options.path || CONFIG.TRANSFERS_PATH;
  return `${normalizedBase}${path}?${params.toString()}`;
}

function looksLikeTransfer(item) {
  if (!item || typeof item !== "object") return false;
  return (
    "transaction_id" in item ||
    "txID" in item ||
    "hash" in item ||
    "contract_address" in item ||
    "amount" in item ||
    "to" in item ||
    "from" in item
  );
}

function extractTransfers(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const candidates = [
    payload.data,
    payload.token_transfers,
    payload.trc20_transfers,
    payload.transfers,
    payload.items,
    payload.list,
  ];
  for (const list of candidates) {
    if (Array.isArray(list)) return list;
  }
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length > 0 && looksLikeTransfer(value[0])) {
      return value;
    }
  }
  return [];
}

function extractTotal(payload) {
  if (!payload || typeof payload !== "object") return null;
  const raw =
    payload.total ??
    payload.totalCount ??
    payload.total_count ??
    payload.count ??
    payload.pageSize;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getTxId(item) {
  return item?.transaction_id ?? item?.txID ?? item?.hash ?? item?.transaction_id_hex ?? "";
}

async function readErrorBody(res) {
  try {
    const text = await res.text();
    if (!text) return "";
    return text.replace(/\s+/g, " ").slice(0, 160);
  } catch {
    return "";
  }
}

function recordAttempt({ source, url, status, records, error }) {
  const statusText = status ? `HTTP ${status}` : "HTTP ?";
  const recordText = `records=${records ?? 0}`;
  const errorText = error ? `error=${error}` : "";
  const line = `#${state.attempts.length + 1} [${source}] ${statusText} ${recordText} ${url}${errorText ? ` ${errorText}` : ""}`;
  state.attempts.push(line);
}

function truncatePayload(payload) {
  if (Array.isArray(payload)) {
    return payload.slice(0, 3);
  }
  if (!payload || typeof payload !== "object") return payload;
  const trimmed = { ...payload };
  for (const [key, value] of Object.entries(trimmed)) {
    if (Array.isArray(value)) {
      trimmed[key] = value.slice(0, 3);
    }
  }
  return trimmed;
}

function updateUrls() {
  if (elements.directUrl) {
    elements.directUrl.textContent = CONFIG.API_BASE
      ? createTransferUrl(CONFIG.API_BASE, 0, 20, {
          mode: CONFIG.PRIMARY_QUERY_MODE,
          confirm: true,
          path: CONFIG.TRANSFERS_PATH,
        })
      : "-";
  }
  if (elements.proxyUrl) {
    elements.proxyUrl.textContent = CONFIG.PROXY_BASE
      ? createTransferUrl(CONFIG.PROXY_BASE, 0, 20, {
          mode: CONFIG.PRIMARY_QUERY_MODE,
          confirm: true,
          path: CONFIG.PROXY_TRANSFERS_PATH,
        })
      : "Proxy base not configured";
  }
}

function renderPayload() {
  if (elements.rawJson) {
    const preview = truncatePayload(state.payload);
    elements.rawJson.textContent = preview ? JSON.stringify(preview, null, 2) : "No data.";
  }
  if (elements.attemptLog) {
    elements.attemptLog.textContent = state.attempts.length ? state.attempts.join("\n") : "No attempts yet.";
  }
}

function renderStatus(message) {
  if (elements.fetchStatus) {
    elements.fetchStatus.textContent = message;
  }
  if (elements.fetchSource) {
    elements.fetchSource.textContent = `Source: ${state.source}`;
  }
}

async function fetchTransfersFromBase(base, sourceLabel) {
  const limit = 20;
  let lastStatus = null;
  let firstPayload = null;

  const runScan = async (options, phaseLabel) => {
    let start = 0;
    let total = Infinity;
    let results = [];

    while (start < CONFIG.MAX_TX_SCAN && start < total) {
      const url = createTransferUrl(base, start, limit, options);
      let res;
      try {
        res = await fetch(url, { cache: "no-store" });
      } catch (error) {
        recordAttempt({
          source: `${sourceLabel}/${phaseLabel}`,
          url,
          status: 0,
          records: 0,
          error: error?.message || "Fetch failed",
        });
        throw error;
      }
      lastStatus = res.status;

      if (!res.ok) {
        const body = await readErrorBody(res);
        const message = body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}`;
        recordAttempt({
          source: `${sourceLabel}/${phaseLabel}`,
          url,
          status: res.status,
          records: 0,
          error: message,
        });
        const error = new Error(message);
        error.status = res.status;
        throw error;
      }

      let payload;
      try {
        payload = await res.json();
      } catch (error) {
        recordAttempt({
          source: `${sourceLabel}/${phaseLabel}`,
          url,
          status: res.status,
          records: 0,
          error: "Invalid JSON",
        });
        throw error;
      }

      if (!firstPayload) {
        firstPayload = payload;
      }

      const list = extractTransfers(payload);
      recordAttempt({
        source: `${sourceLabel}/${phaseLabel}`,
        url,
        status: res.status,
        records: Array.isArray(list) ? list.length : 0,
        error: "",
      });

      const totalCount = extractTotal(payload);
      if (Number.isFinite(totalCount)) {
        total = totalCount;
      }

      if (!Array.isArray(list) || list.length === 0) {
        break;
      }

      results = results.concat(list);
      start += list.length;
    }

    return results;
  };

  const isProxy = sourceLabel.toLowerCase().includes("proxy");
  const primaryPath = isProxy ? CONFIG.PROXY_TRANSFERS_PATH : CONFIG.TRANSFERS_PATH;
  const fallbackPath = isProxy ? CONFIG.PROXY_TRANSFERS_PATH : CONFIG.FALLBACK_PATH;

  let transfers = await runScan(
    {
      mode: CONFIG.PRIMARY_QUERY_MODE,
      confirm: true,
      path: primaryPath,
    },
    "primary"
  );

  if (transfers.length === 0 && fallbackPath) {
    transfers = await runScan(
      {
        mode: CONFIG.FALLBACK_QUERY_MODE,
        confirm: CONFIG.FALLBACK_CONFIRM,
        path: fallbackPath,
      },
      "fallback"
    );
  }

  return { transfers, status: lastStatus, payload: firstPayload };
}

async function fetchAndRender(mode) {
  updateUrls();
  state.attempts = [];
  state.payload = null;
  state.transfers = [];
  state.source = mode === "proxy" ? "Proxy" : "Direct Tronscan API";
  state.status = "-";

  const base = mode === "proxy" ? sanitizeBase(CONFIG.PROXY_BASE) : sanitizeBase(CONFIG.API_BASE);
  if (!base) {
    renderStatus("Status: Proxy base not configured");
    renderPayload();
    return;
  }

  renderStatus("Status: Loading...");

  try {
    const result = await fetchTransfersFromBase(base, state.source);
    state.payload = result.payload;
    state.transfers = result.transfers;
    state.status = result.status ? `HTTP ${result.status}` : "OK";
    renderStatus(`Status: ${state.status} (records: ${state.transfers.length})`);
    renderPayload();
  } catch (error) {
    const statusNote = error?.status ? `HTTP ${error.status}` : "Error";
    renderStatus(`Status: ${statusNote} - ${error.message || "Fetch failed"}`);
    renderPayload();
  }
}

function searchTx() {
  const query = (elements.txSearch?.value || "").trim().toLowerCase();
  if (!query) {
    elements.searchResult.textContent = "Enter a tx hash to search.";
    return;
  }

  const match = state.transfers.find((item) => getTxId(item).toLowerCase() === query);
  if (match) {
    elements.searchResult.textContent = JSON.stringify(match, null, 2);
  } else {
    elements.searchResult.textContent = "TX hash not found in fetched records.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateUrls();
  elements.btnFetchDirect?.addEventListener("click", () => fetchAndRender("direct"));
  elements.btnFetchProxy?.addEventListener("click", () => fetchAndRender("proxy"));
  elements.btnTestProxy?.addEventListener("click", () => fetchAndRender("proxy"));
  elements.btnSearch?.addEventListener("click", searchTx);
});
