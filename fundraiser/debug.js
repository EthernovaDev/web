const FALLBACK_CONFIG = {
  TRON_ADDRESS: "TVYT4XtYtnBEg5VnKNUnx1n8oUeZ8mq2Lg",
  USDT_CONTRACT_TRON: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
  API_BASE: "https://apilist.tronscanapi.com",
  API_BASES: [
    "https://apilist.tronscanapi.com",
    "https://apilist.tronscan.org",
  ],
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
  base1Url: $("base1Url"),
  base2Url: $("base2Url"),
  proxyUrl: $("proxyUrl"),
  btnFetchBase1: $("btnFetchBase1"),
  btnFetchBase2: $("btnFetchBase2"),
  btnFetchProxy: $("btnFetchProxy"),
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

function getApiBases() {
  if (Array.isArray(CONFIG.API_BASES) && CONFIG.API_BASES.length > 0) {
    return CONFIG.API_BASES.map((base) => sanitizeBase(base)).filter(Boolean);
  }
  const fallback = sanitizeBase(CONFIG.API_BASE);
  return fallback ? [fallback] : [];
}

function createTransferUrl(base, start, limit, options = {}) {
  const normalizedBase = apiBase(base);
  const confirm = options.confirm === false ? "false" : "true";
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    contract_address: CONFIG.USDT_CONTRACT_TRON,
    relatedAddress: CONFIG.TRON_ADDRESS,
    confirm,
  });
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
    return text.replace(/\s+/g, " ").slice(0, 500);
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
  const bases = getApiBases();
  if (elements.base1Url) {
    elements.base1Url.textContent = bases[0]
      ? createTransferUrl(bases[0], 0, 20, {
          confirm: true,
          path: CONFIG.TRANSFERS_PATH,
        })
      : "-";
  }
  if (elements.base2Url) {
    elements.base2Url.textContent = bases[1]
      ? createTransferUrl(bases[1], 0, 20, {
          confirm: true,
          path: CONFIG.TRANSFERS_PATH,
        })
      : "-";
  }
  if (elements.proxyUrl) {
    elements.proxyUrl.textContent = CONFIG.PROXY_BASE
      ? createTransferUrl(CONFIG.PROXY_BASE, 0, 20, {
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

async function fetchAndRender(base, source) {
  updateUrls();
  state.attempts = [];
  state.payload = null;
  state.transfers = [];
  state.source = source;
  state.status = "-";
  if (!base) {
    renderStatus("Status: Base not configured");
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
  const bases = getApiBases();
  elements.btnFetchBase1?.addEventListener("click", () => {
    fetchAndRender(bases[0], "Base #1");
  });
  elements.btnFetchBase2?.addEventListener("click", () => {
    fetchAndRender(bases[1], "Base #2");
  });
  elements.btnFetchProxy?.addEventListener("click", () => {
    fetchAndRender(sanitizeBase(CONFIG.PROXY_BASE), "Proxy");
  });
  elements.btnSearch?.addEventListener("click", searchTx);
});
