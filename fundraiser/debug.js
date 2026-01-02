const CONFIG = {
  TRON_ADDRESS: "TVYT4XtYtnBEg5VnKNUnx1n8oUeZ8mq2Lg",
  USDT_CONTRACT_TRON: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  API_BASES: [
    "https://apilist.tronscanapi.com",
    "https://apilist.tronscan.org",
  ],
  PROXY_BASE: "https://ethnova-tronscan-proxy.jemc787.workers.dev",
  API_MODE: "proxy",
  MAX_TX_SCAN: 500,
};

const $ = (id) => document.getElementById(id);

const elements = {
  base1Url: $("base1Url"),
  base2Url: $("base2Url"),
  proxyUrl: $("proxyUrl"),
  btnCopyProxy: $("btnCopyProxy"),
  btnFetchBase1: $("btnFetchBase1"),
  btnFetchBase2: $("btnFetchBase2"),
  btnFetchProxy: $("btnFetchProxy"),
  fetchStatus: $("fetchStatus"),
  fetchSource: $("fetchSource"),
  recordCount: $("recordCount"),
  incomingCount: $("incomingCount"),
  responseSnippet: $("responseSnippet"),
  rawJson: $("rawJson"),
  attemptLog: $("attemptLog"),
  txSearch: $("txSearch"),
  btnSearchTx: $("btnSearchTx"),
  searchResult: $("searchResult"),
  debugInitError: $("debugInitError"),
};

const state = {
  transfers: [],
  payload: null,
  attempts: [],
  source: "Ready",
  status: "Ready",
  recordCount: 0,
  incomingCount: 0,
  fetchSucceeded: false,
  errorSnippet: "-",
};

function sanitizeBase(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function normalizeAddress(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function getApiBases() {
  return (CONFIG.API_BASES || []).map((base) => sanitizeBase(base)).filter(Boolean);
}

function getProxyBase() {
  const base = sanitizeBase(CONFIG.PROXY_BASE);
  if (!base) return "";
  if (base.includes("<PASTE_WORKER_URL_HERE>")) return "";
  return base;
}

function createTransferUrl(base, start, limit, confirmValue, path) {
  const normalizedBase = sanitizeBase(base);
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    confirm: "0",
    direction: "in",
    contract_address: CONFIG.USDT_CONTRACT_TRON,
    relatedAddress: CONFIG.TRON_ADDRESS,
  });
  const finalPath = path || "/api/token_trc20/transfers";
  return `${normalizedBase}${finalPath}?${params.toString()}`;
}

function looksLikeTransfer(item) {
  if (!item || typeof item !== "object") return false;
  return (
    "transaction_id" in item ||
    "txID" in item ||
    "txid" in item ||
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
  const raw = payload.total ?? payload.totalCount ?? payload.total_count ?? payload.count ?? payload.pageSize;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getTxId(item) {
  return item?.transaction_id ?? item?.txID ?? item?.txid ?? item?.hash ?? item?.transaction_id_hex ?? "";
}

function getToAddress(item) {
  return (
    item?.to ??
    item?.to_address ??
    item?.transferInfo?.to ??
    item?.contractData?.to ??
    item?.toAddress ??
    ""
  );
}

function getFromAddress(item) {
  return (
    item?.from ??
    item?.from_address ??
    item?.transferInfo?.from ??
    item?.contractData?.owner_address ??
    item?.fromAddress ??
    ""
  );
}

function parseTimestamp(item) {
  const raw = item?.block_timestamp ?? item?.block_ts ?? item?.timestamp ?? item?.time ?? null;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n > 1e12 ? n : n * 1000;
}

function parseBlock(item) {
  const raw = item?.block ?? item?.block_number ?? item?.blockNumber ?? item?.blockHeight ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function isConfirmed(item) {
  if (item?.confirmed === true) return true;
  const block = parseBlock(item);
  return block > 0;
}

function isUsdt(item) {
  const contract = item?.contract_address ?? item?.contractAddress ?? item?.token_info?.address ?? "";
  return normalizeAddress(contract) === normalizeAddress(CONFIG.USDT_CONTRACT_TRON);
}

function isIncoming(item) {
  const target = normalizeAddress(CONFIG.TRON_ADDRESS);
  const to = normalizeAddress(getToAddress(item));
  return to && to === target;
}

function findDecimals(item) {
  const raw = item?.token_info?.decimals ?? item?.tokenDecimal ?? item?.token_decimal ?? item?.decimals ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRawAmount(item) {
  return item?.amount_str ?? item?.amount ?? item?.value ?? item?.quant ?? item?.token_amount ?? null;
}

function convertAmount(raw, decimals) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.includes(".")) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n / Math.pow(10, decimals);
}

function truncatePayload(payload) {
  if (Array.isArray(payload)) return payload.slice(0, 3);
  if (!payload || typeof payload !== "object") return payload;
  const trimmed = { ...payload };
  for (const [key, value] of Object.entries(trimmed)) {
    if (Array.isArray(value)) trimmed[key] = value.slice(0, 3);
  }
  return trimmed;
}

function recordAttempt({ source, url, status, records, error }) {
  const statusText = status ? `HTTP ${status}` : "HTTP ?";
  const recordText = `records=${records ?? 0}`;
  const errorText = error ? `error=${error}` : "";
  const line = `#${state.attempts.length + 1} [${source}] ${statusText} ${recordText} ${url}${errorText ? ` ${errorText}` : ""}`;
  state.attempts.push(line);
}

function renderStatus(statusText, sourceText) {
  if (elements.fetchStatus) {
    elements.fetchStatus.textContent = `Status: ${statusText}`;
  }
  if (elements.fetchSource) {
    elements.fetchSource.textContent = `Source: ${sourceText}`;
  }
  if (elements.recordCount) {
    elements.recordCount.textContent = String(state.recordCount);
  }
  if (elements.incomingCount) {
    elements.incomingCount.textContent = String(state.incomingCount);
  }
  if (elements.responseSnippet) {
    elements.responseSnippet.textContent = `Response: ${state.errorSnippet || "-"}`;
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

async function readErrorBody(res) {
  try {
    const text = await res.text();
    if (!text) return "";
    return text.replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}

async function fetchTransfersFromBase(base, sourceLabel, path) {
  const limit = 20;
  let start = 0;
  let total = Infinity;
  let results = [];
  let lastStatus = null;
  let firstPayload = null;

  while (start < CONFIG.MAX_TX_SCAN && start < total) {
    const url = createTransferUrl(base, start, limit, true, path);
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (error) {
      recordAttempt({ source: sourceLabel, url, status: 0, records: 0, error: error?.message || "Fetch failed" });
      throw error;
    }

    lastStatus = res.status;

    if (!res.ok) {
      const body = await readErrorBody(res);
      const message = body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}`;
      recordAttempt({ source: sourceLabel, url, status: res.status, records: 0, error: message });
      const error = new Error(message);
      error.status = res.status;
      error.body = body;
      throw error;
    }

    let payload;
    try {
      payload = await res.json();
    } catch (error) {
      recordAttempt({ source: sourceLabel, url, status: res.status, records: 0, error: "Invalid JSON" });
      throw error;
    }

    if (!firstPayload) {
      firstPayload = payload;
    }

    const list = extractTransfers(payload);
    recordAttempt({ source: sourceLabel, url, status: res.status, records: Array.isArray(list) ? list.length : 0, error: "" });

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

  return { transfers: results, payload: firstPayload, status: lastStatus };
}

function countIncoming(records) {
  return records.filter((item) => isUsdt(item) && isConfirmed(item) && isIncoming(item)).length;
}

function formatSearchResult(item) {
  const tx = getTxId(item) || "-";
  const from = getFromAddress(item) || "-";
  const to = getToAddress(item) || "-";
  const decimals = findDecimals(item) ?? 6;
  const amountRaw = parseRawAmount(item);
  const amount = convertAmount(amountRaw, decimals);
  const timestamp = parseTimestamp(item);
  const iso = timestamp ? new Date(timestamp).toISOString() : "-";

  return [
    `Tx: ${tx}`,
    `From: ${from}`,
    `To: ${to}`,
    `Amount: ${amount !== null ? amount.toFixed(2) : "-"} USDT`,
    `Timestamp: ${iso}`,
  ].join("\n");
}

async function fetchAndRender(base, sourceLabel, path) {
  state.attempts = [];
  state.payload = null;
  state.transfers = [];
  state.recordCount = 0;
  state.incomingCount = 0;
  state.fetchSucceeded = false;
  state.errorSnippet = "-";

  if (!base) {
    state.errorSnippet = sourceLabel === "Proxy" ? "Proxy base not configured" : "Base not configured";
    renderStatus("Error", sourceLabel);
    renderPayload();
    return;
  }

  renderStatus("Fetching...", sourceLabel);

  try {
    const result = await fetchTransfersFromBase(base, sourceLabel, path);
    state.payload = result.payload;
    state.transfers = result.transfers;
    state.recordCount = result.transfers.length;
    state.incomingCount = countIncoming(result.transfers);
    state.fetchSucceeded = true;
    state.errorSnippet = "-";
    const statusText = result.status ? `HTTP ${result.status}` : "OK";
    renderStatus(statusText, sourceLabel);
    renderPayload();
  } catch (error) {
    const statusText = error?.status ? `HTTP ${error.status}` : "Error";
    const hint = error?.status === 400 ? " Check confirm param: must be 0/1/0,1 not true/false." : "";
    state.errorSnippet = `${error?.body || error?.message || "Fetch failed"}${hint}`;
    renderStatus(statusText, sourceLabel);
    renderPayload();
  }
}

function updateUrls() {
  const bases = getApiBases();
  if (elements.base1Url) {
    elements.base1Url.textContent = bases[0]
      ? createTransferUrl(bases[0], 0, 20, true, "/api/token_trc20/transfers")
      : "-";
  }
  if (elements.base2Url) {
    elements.base2Url.textContent = bases[1]
      ? createTransferUrl(bases[1], 0, 20, true, "/api/token_trc20/transfers")
      : "-";
  }
  if (elements.proxyUrl) {
    const proxyBase = getProxyBase();
    elements.proxyUrl.textContent = proxyBase
      ? createTransferUrl(proxyBase, 0, 20, true, "/trc20/transfers")
      : "(not configured)";
  }
}

function searchTx() {
  const query = (elements.txSearch?.value || "").trim().toLowerCase();
  if (!query) {
    if (elements.searchResult) elements.searchResult.textContent = "Enter a tx hash to search.";
    return;
  }
  const match = state.transfers.find((item) => getTxId(item).toLowerCase() === query);
  if (match) {
    if (elements.searchResult) elements.searchResult.textContent = formatSearchResult(match);
    return;
  }
  if (state.fetchSucceeded) {
    if (elements.searchResult) {
      elements.searchResult.textContent = "Not returned by API results (possible indexing delay).";
    }
  } else if (elements.searchResult) {
    elements.searchResult.textContent = "No data yet. Fetch data first.";
  }
}

function showInitError(error) {
  console.error("DEBUG INIT FAILED:", error);
  if (elements.debugInitError) {
    elements.debugInitError.hidden = false;
    elements.debugInitError.textContent = `DEBUG INIT FAILED: ${error?.message || error}`;
  }
}

function init() {
  updateUrls();
  renderStatus("Ready", "Ready");

  const bases = getApiBases();
  elements.btnFetchBase1?.addEventListener("click", () => {
    fetchAndRender(bases[0], "Base #1", "/api/token_trc20/transfers");
  });
  elements.btnFetchBase2?.addEventListener("click", () => {
    fetchAndRender(bases[1], "Base #2", "/api/token_trc20/transfers");
  });
  elements.btnFetchProxy?.addEventListener("click", () => {
    fetchAndRender(getProxyBase(), "Proxy", "/trc20/transfers");
  });
  elements.btnCopyProxy?.addEventListener("click", async () => {
    const proxyBase = getProxyBase();
    if (!proxyBase) return;
    try {
      await navigator.clipboard.writeText(proxyBase);
      elements.btnCopyProxy.textContent = "Copied";
      setTimeout(() => {
        elements.btnCopyProxy.textContent = "Copy";
      }, 1200);
    } catch {
      elements.btnCopyProxy.textContent = "Copy";
    }
  });
  elements.btnSearchTx?.addEventListener("click", searchTx);
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (error) {
    showInitError(error);
  }
});
