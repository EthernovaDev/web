const CONFIG = {
  TRON_ADDRESS: "TVYT4XtYtnBEg5VnKNUnx1n8oUeZ8mq2Lg",
  GOAL_USDT: 3900,
  LAUNCH_DATE_UTC: "2026-01-01T00:00:00Z",
  DEADLINE_DAYS: 45,
  USDT_CONTRACT_TRON: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  API_MODE: "proxy",
  PROXY_BASE: "https://ethnova-tronscan-proxy.jemc787.workers.dev",
  PROXY_TRANSFERS_PATH: "/trc20/transfers",
  TRONSCAN_WALLET_URL: "https://tronscan.org/#/address/{ADDRESS}",
  TRONSCAN_TX_URL: "https://tronscan.org/#/transaction/{TX}",
  REFRESH_SECONDS: 60,
  MAX_TX_SCAN: 500,
  SHOW_DONOR_ADDRESSES: true,
  DONATIONS_LIST_LIMIT: 25,
  DEBUG_ENABLED: false,
  KNOWN_TX_HASHES: ["9402383dc1754a3b487fb3483092e869754e2922016e262974852049b0295de2"],
};

const BUILD_ID = "20260102-bootfix-1";

if (typeof window !== "undefined") {
  window.FUNDRAISER_CONFIG = CONFIG;
}

const FEED_LIMIT = 8;
let refreshTick = 0;

const $ = (id) => document.getElementById(id);

const elements = {
  addressText: $("addressText"),
  copyButton: $("copyButton"),
  qrCanvas: $("qrCanvas"),
  verifyWalletBtn: $("btnVerifyWallet"),
  latestTxBtn: $("btnLatestTx"),
  latestTxCaption: $("latestTxCaption"),
  dataSource: $("dataSource"),
  dataRecords: $("dataRecords"),
  goalValue: $("goalValue"),
  raisedValue: $("raisedValue"),
  remainingValue: $("remainingValue"),
  percentValue: $("percentValue"),
  progressFill: $("progressFill"),
  deadlineDate: $("deadlineDate"),
  daysRemaining: $("daysRemaining"),
  deadlineWarning: $("deadlineWarning"),
  tronscanDelay: $("tronscanDelay"),
  delayWalletLink: $("delayWalletLink"),
  delayTxLink: $("delayTxLink"),
  corsBanner: $("corsBanner"),
  proxyBanner: $("proxyBanner"),
  lastUpdated: $("lastUpdated"),
  refreshSeconds: $("refreshSeconds"),
  feedRefreshSeconds: $("feedRefreshSeconds"),
  donationsList: $("donationsList"),
  donationEmpty: $("donationEmpty"),
  feedList: $("feedList"),
  feedEmpty: $("feedEmpty"),
  refreshButton: $("refreshButton"),
  knownTxNotice: $("knownTxNotice"),
  knownTxButton: $("btnKnownTx"),
  diagnosticsToggle: $("diagnosticsToggle"),
  diagnosticsPanel: $("diagnosticsPanel"),
  heartbeat: $("heartbeat"),
  diagSource: $("diagSource"),
  diagBase: $("diagBase"),
  diagBuild: $("diagBuild"),
  diagQuery: $("diagQuery"),
  diagConfirm: $("diagConfirm"),
  diagFetchTime: $("diagFetchTime"),
  diagStatus: $("diagStatus"),
  diagRecords: $("diagRecords"),
  diagIncoming: $("diagIncoming"),
  diagLatestTx: $("diagLatestTx"),
  diagKnownTx: $("diagKnownTx"),
  diagError: $("diagError"),
  diagAttempts: $("diagAttempts"),
  copyDiagnostics: $("copyDiagnostics"),
  debugLink: $("debugLink"),
};

const state = {
  decimals: null,
  deadline: null,
  latestIncomingTxHash: "",
  latestIncomingTxUrl: "",
  diagnostics: {
    source: "Proxy",
    base: CONFIG.PROXY_BASE,
    build: BUILD_ID,
    query: "pending",
    confirm: "0",
    lastFetch: "pending",
    httpStatus: "pending",
    records: 0,
    incoming: 0,
    latestTx: "none",
    knownTx: "pending",
    error: "none",
    attempts: [],
    notes: [],
  },
};

function sanitizeBase(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function normalizeAddress(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function getProxyBase() {
  const base = sanitizeBase(CONFIG.PROXY_BASE);
  if (!base) return "";
  if (base.includes("<PASTE_WORKER_URL_HERE>")) return "";
  return base;
}

function isProxyConfigured() {
  return Boolean(getProxyBase());
}

function formatUSDT(value) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value, digits) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function shortAddress(addr) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortTx(tx) {
  if (!tx) return "TX";
  return `${tx.slice(0, 6)}...${tx.slice(-4)}`;
}

function formatDateUtc(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function formatChicago(date, withTime) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  const options = {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "2-digit",
  };
  if (withTime) {
    options.hour = "numeric";
    options.minute = "2-digit";
    options.hour12 = true;
  }
  const formatted = new Intl.DateTimeFormat("en-US", options).format(date);
  return `${formatted} (Chicago)`;
}

function nowChicago() {
  return formatChicago(new Date(), true);
}

function setHeartbeat(message) {
  if (!elements.heartbeat) return;
  elements.heartbeat.textContent = message;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn("Missing element id:", id);
    return;
  }
  el.textContent = String(value ?? "");
}

function timeAgo(ts) {
  if (!ts) return "-";
  const diffMs = Date.now() - ts;
  if (!Number.isFinite(diffMs)) return "-";
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getDeadline() {
  if (state.deadline) return state.deadline;
  const launch = new Date(CONFIG.LAUNCH_DATE_UTC);
  const deadlineMs = launch.getTime() + CONFIG.DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  state.deadline = new Date(deadlineMs);
  return state.deadline;
}

function updateDeadline() {
  const deadline = getDeadline();
  const now = Date.now();
  const diffMs = deadline.getTime() - now;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  elements.daysRemaining.textContent = String(daysRemaining);
  elements.deadlineDate.textContent = formatChicago(deadline, false);

  if (diffMs <= 0) {
    elements.deadlineWarning.hidden = false;
  } else {
    elements.deadlineWarning.hidden = true;
  }
}

function updateProgress(totalRaised) {
  const remaining = Math.max(0, CONFIG.GOAL_USDT - totalRaised);
  const percent = Math.min(100, (totalRaised / CONFIG.GOAL_USDT) * 100);

  elements.goalValue.textContent = `${formatUSDT(CONFIG.GOAL_USDT)} USDT`;
  elements.raisedValue.textContent = `${formatUSDT(totalRaised)} USDT`;
  elements.remainingValue.textContent = `${formatUSDT(remaining)} USDT`;
  elements.percentValue.textContent = `${formatNumber(percent, 1)}%`;
  elements.progressFill.style.width = `${percent}%`;
}

function showErrorBanner(message) {
  if (!elements.corsBanner) return;
  if (!message) {
    elements.corsBanner.hidden = true;
    return;
  }
  elements.corsBanner.textContent = message;
  elements.corsBanner.hidden = false;
}

function showProxyBanner(show) {
  if (!elements.proxyBanner) return;
  elements.proxyBanner.hidden = !show;
}

function setDataSource(label, base) {
  if (elements.dataSource) {
    const suffix = base ? ` (${base})` : "";
    elements.dataSource.textContent = `Source: ${label}${suffix}`;
  }
  state.diagnostics.source = label;
  state.diagnostics.base = base || "not configured";
  setText("diagSource", label || "Proxy");
  setText("diagBase", base || "not configured");
  setText("diagBuild", BUILD_ID);
}

function updateDataRecords(count) {
  if (!elements.dataRecords) return;
  const value = Number.isFinite(count) ? count : 0;
  elements.dataRecords.textContent = `Records: ${value}`;
}

function setLatestTxState(tx, reason) {
  const hasTx = Boolean(tx);
  state.latestIncomingTxHash = hasTx ? tx : "";
  state.latestIncomingTxUrl = hasTx ? buildTxUrl(tx) : "";

  if (elements.latestTxBtn) {
    if (hasTx) {
      elements.latestTxBtn.href = buildTxUrl(tx);
      elements.latestTxBtn.textContent = "Latest tx";
      elements.latestTxBtn.classList.remove("disabled");
      elements.latestTxBtn.setAttribute("aria-disabled", "false");
    } else {
      elements.latestTxBtn.href = "#";
      elements.latestTxBtn.textContent = "Latest tx (none)";
      elements.latestTxBtn.classList.add("disabled");
      elements.latestTxBtn.setAttribute("aria-disabled", "true");
    }
  }

  if (elements.latestTxCaption) {
    const label = hasTx ? `Latest: ${shortTx(tx)}` : reason || "Latest: none";
    elements.latestTxCaption.textContent = label;
  }

  if (elements.diagLatestTx) {
    if (hasTx) {
      setText("diagLatestTx", tx);
      elements.diagLatestTx.href = buildTxUrl(tx);
      elements.diagLatestTx.setAttribute("aria-disabled", "false");
    } else {
      setText("diagLatestTx", "none");
      elements.diagLatestTx.href = "#";
      elements.diagLatestTx.setAttribute("aria-disabled", "true");
    }
  }
  state.diagnostics.latestTx = hasTx ? tx : "none";
}

function shouldShowDebugLink() {
  if (CONFIG.DEBUG_ENABLED) return true;
  const params = new URLSearchParams(window.location.search);
  return params.has("debug");
}

function updateDiagnosticsUI() {
  setText("diagBuild", state.diagnostics.build || BUILD_ID);
  setText("diagSource", state.diagnostics.source || "Proxy");
  setText("diagBase", state.diagnostics.base || "not configured");
  setText("diagQuery", state.diagnostics.query || "pending");
  setText("diagConfirm", state.diagnostics.confirm || "0");
  setText("diagFetchTime", state.diagnostics.lastFetch || "pending");
  setText("diagStatus", state.diagnostics.httpStatus || "pending");
  setText("diagRecords", String(state.diagnostics.records ?? 0));
  setText("diagIncoming", String(state.diagnostics.incoming ?? 0));
  setText("diagLatestTx", state.diagnostics.latestTx || "none");
  setText("diagKnownTx", state.diagnostics.knownTx || "pending");
  setText("diagError", state.diagnostics.error || "none");

  const attempts = state.diagnostics.attempts.slice();
  if (state.diagnostics.notes.length > 0) {
    attempts.push("Notes:");
    state.diagnostics.notes.forEach((note) => attempts.push(`- ${note}`));
  }
  setText("diagAttempts", attempts.length ? attempts.join("\n") : "No attempts yet.");
}

function setDiagnostics(status) {
  state.diagnostics.query = status;
  updateDiagnosticsUI();
}

function copyDiagnosticsToClipboard() {
  const lines = [
    `Source: ${state.diagnostics.source}`,
    `Base: ${state.diagnostics.base}`,
    `Query: ${state.diagnostics.query}`,
    `Confirm: ${state.diagnostics.confirm}`,
    `Last fetch: ${state.diagnostics.lastFetch}`,
    `HTTP status: ${state.diagnostics.httpStatus}`,
    `Records: ${state.diagnostics.records}`,
    `Incoming matched: ${state.diagnostics.incoming}`,
    `Latest tx: ${state.diagnostics.latestTx}`,
    `Known tx: ${state.diagnostics.knownTx}`,
    `Error: ${state.diagnostics.error || "-"}`,
  ];
  if (state.diagnostics.notes.length > 0) {
    lines.push("Notes:");
    state.diagnostics.notes.forEach((note) => lines.push(`- ${note}`));
  }
  if (state.diagnostics.attempts.length > 0) {
    lines.push("Attempts:");
    state.diagnostics.attempts.forEach((attempt) => lines.push(attempt));
  }
  return navigator.clipboard.writeText(lines.join("\n"));
}

function openInNewTab(url, button) {
  if (!url) return;
  if (button) {
    const original = button.textContent;
    button.textContent = "Opening...";
    setTimeout(() => {
      button.textContent = original;
    }, 800);
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function getKnownTxHashes() {
  return Array.isArray(CONFIG.KNOWN_TX_HASHES)
    ? CONFIG.KNOWN_TX_HASHES.filter((tx) => typeof tx === "string" && tx.length > 0)
    : [];
}

function updateKnownTxNotice(records, hasError) {
  if (!elements.knownTxNotice || !elements.knownTxButton) return;
  const known = getKnownTxHashes();
  if (known.length === 0) {
    state.diagnostics.knownTx = "none";
    setText("diagKnownTx", "none");
    elements.knownTxNotice.hidden = true;
    return;
  }
  if (hasError) {
    state.diagnostics.knownTx = "UNAVAILABLE";
    setText("diagKnownTx", "UNAVAILABLE");
    elements.knownTxNotice.hidden = true;
    return;
  }
  const found = records.some((item) => {
    const tx = typeof item === "string" ? item : item?.tx ?? getTxId(item);
    return tx ? known.includes(tx) : false;
  });
  state.diagnostics.knownTx = found ? "FOUND" : "NOT FOUND";
  setText("diagKnownTx", state.diagnostics.knownTx);
  elements.knownTxNotice.hidden = found;
  const firstKnown = known[0];
  elements.knownTxButton.dataset.tx = firstKnown;
}

function buildWalletUrl() {
  return CONFIG.TRONSCAN_WALLET_URL.replace("{ADDRESS}", CONFIG.TRON_ADDRESS);
}

function buildWalletUrlFor(address) {
  if (!address) return buildWalletUrl();
  return CONFIG.TRONSCAN_WALLET_URL.replace("{ADDRESS}", address);
}

function buildTxUrl(tx) {
  return CONFIG.TRONSCAN_TX_URL.replace("{TX}", tx);
}

function buildProxyUrl(start, limit) {
  const proxyBase = getProxyBase();
  if (!proxyBase) return "";
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    confirm: "0",
    direction: "in",
    contract_address: CONFIG.USDT_CONTRACT_TRON,
    relatedAddress: CONFIG.TRON_ADDRESS,
  });
  return `${proxyBase}${CONFIG.PROXY_TRANSFERS_PATH}?${params.toString()}`;
}

function recordAttempt({ source, url, status, records, error }) {
  const statusText = status ? `HTTP ${status}` : "HTTP ?";
  const recordText = `records=${records ?? 0}`;
  const errorText = error ? `error=${error}` : "";
  const line = `#${state.diagnostics.attempts.length + 1} [${source}] ${statusText} ${recordText} ${url}${errorText ? ` ${errorText}` : ""}`;
  state.diagnostics.attempts.push(line);
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

function extractProxyTransfers(payload) {
  if (!payload || typeof payload !== "object") return [];
  return Array.isArray(payload.token_transfers) ? payload.token_transfers : [];
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

async function readErrorBody(res) {
  try {
    const text = await res.text();
    if (!text) return "";
    return text.replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}

function findDecimals(item) {
  const raw =
    item?.token_info?.decimals ??
    item?.tokenDecimal ??
    item?.token_decimal ??
    item?.decimals ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRawAmount(item) {
  return (
    item?.amount_str ??
    item?.amount ??
    item?.value ??
    item?.quant ??
    item?.token_amount ??
    null
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

function isConfirmedTransfer(item) {
  if (item?.confirmed === true) return true;
  const block = parseBlock(item);
  if (block > 0) return true;
  if (item?.confirmed === false && block <= 0) return false;
  return true;
}

function isUsdtTransfer(item) {
  const contract =
    item?.contract_address ??
    item?.contractAddress ??
    item?.token_info?.address ??
    "";
  return normalizeAddress(contract) === normalizeAddress(CONFIG.USDT_CONTRACT_TRON);
}

function getToAddress(item) {
  return (
    item?.to_address ??
    item?.to_address_base58 ??
    item?.toAddress ??
    item?.to ??
    item?.to_address_hex ??
    ""
  );
}

function isIncomingTransfer(item) {
  const target = normalizeAddress(CONFIG.TRON_ADDRESS);
  const candidates = [
    item?.to,
    item?.to_address,
    item?.transferInfo?.to,
    item?.transferInfo?.to_address,
    item?.transferInfo?.toAddress,
    item?.contractData?.to,
    item?.toAddress,
    getToAddress(item),
  ];

  return candidates.some((value) => normalizeAddress(value) === target);
}

function getFromAddress(item) {
  return (
    item?.from_address ??
    item?.from_address_base58 ??
    item?.fromAddress ??
    item?.from ??
    item?.transferInfo?.from ??
    item?.transferInfo?.owner_address ??
    item?.contractData?.owner_address ??
    item?.from_address_hex ??
    ""
  );
}

function getTxId(item) {
  return (
    item?.transaction_id ??
    item?.txID ??
    item?.txid ??
    item?.hash ??
    item?.transaction_id_hex ??
    ""
  );
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

async function fetchTransfersFromBase(sourceLabel) {
  const limit = 20;
  let lastStatus = null;
  let start = 0;
  let total = Infinity;
  let results = [];

  while (start < CONFIG.MAX_TX_SCAN && start < total) {
    const url = buildProxyUrl(start, limit);
    console.log("[fundraiser] fetch:", url);
    if (!url) {
      recordAttempt({
        source: sourceLabel,
        url: "(proxy base not configured)",
        status: 0,
        records: 0,
        error: "Proxy base not configured",
      });
      const err = new Error("Proxy base not configured");
      err.status = 0;
      throw err;
    }
    if (start === 0) {
      const parsed = new URL(url);
      state.diagnostics.query = parsed.searchParams.toString();
      state.diagnostics.confirm = parsed.searchParams.get("confirm") || "-";
    }
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (error) {
      recordAttempt({
        source: sourceLabel,
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
        source: sourceLabel,
        url,
        status: res.status,
        records: 0,
        error: message,
      });
      const error = new Error(message);
      error.status = res.status;
      error.body = body;
      throw error;
    }

    let payload;
    try {
      payload = await res.json();
    } catch (error) {
      recordAttempt({
        source: sourceLabel,
        url,
        status: res.status,
        records: 0,
        error: "Invalid JSON",
      });
      throw error;
    }

    const list = extractProxyTransfers(payload);
    recordAttempt({
      source: sourceLabel,
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
    start += limit;
  }

  return { transfers: results, status: lastStatus };
}

async function fetchTransfers() {
  const proxyBase = getProxyBase();
  if (!proxyBase) {
    recordAttempt({
      source: "Proxy",
      url: "(proxy base not configured)",
      status: 0,
      records: 0,
      error: "Proxy base not configured",
    });
    const err = new Error("Proxy base not configured");
    err.status = 0;
    throw err;
  }

  const result = await fetchTransfersFromBase("Proxy");
  return { transfers: result.transfers, source: "Proxy", base: proxyBase, status: result.status };
}

function filterIncoming(transfers) {
  return transfers.filter((item) => {
    if (!isUsdtTransfer(item)) return false;
    if (!isConfirmedTransfer(item)) return false;
    return isIncomingTransfer(item);
  });
}

function prepareProxyDonations(transfers) {
  state.diagnostics.notes = [];
  const donations = [];
  const target = normalizeAddress(CONFIG.TRON_ADDRESS);

  for (const item of transfers) {
    const to = normalizeAddress(item?.to_address ?? "");
    if (!to || to !== target) continue;
    if (!isConfirmedTransfer(item)) continue;

    const rawAmount = item?.quant ?? null;
    if (rawAmount === null || rawAmount === undefined) {
      state.diagnostics.notes.push("Skipped transfer with missing quant.");
      continue;
    }

    let decimals = Number(item?.tokenInfo?.tokenDecimal);
    if (!Number.isFinite(decimals)) {
      decimals = 6;
      state.diagnostics.notes.push("Token decimals missing; defaulted to 6.");
    }

    const amount = convertAmount(rawAmount, decimals);
    if (!Number.isFinite(amount)) {
      state.diagnostics.notes.push("Skipped transfer with invalid amount.");
      continue;
    }

    const tx = item?.transaction_id || "";
    if (!tx) {
      state.diagnostics.notes.push("Skipped transfer with missing tx hash.");
      continue;
    }

    donations.push({
      amount,
      timestamp: parseTimestamp(item),
      tx,
      from: item?.from_address ?? "",
    });
  }

  donations.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalRaised = donations.reduce((sum, d) => sum + (Number.isFinite(d.amount) ? d.amount : 0), 0);

  return { donations, totalRaised };
}

function prepareDonations(transfers, isProxy) {
  if (isProxy) {
    return prepareProxyDonations(transfers);
  }

  const incoming = filterIncoming(transfers);
  state.diagnostics.notes = [];

  let decimals = state.decimals;
  if (decimals === null) {
    for (const item of incoming) {
      const found = findDecimals(item);
      if (found !== null) {
        decimals = found;
        break;
      }
    }
    if (decimals === null) {
      // Fallback to 6 decimals for USDT if API does not provide decimals.
      decimals = 6;
      state.diagnostics.notes.push("Token decimals missing; defaulted to 6.");
    }
    state.decimals = decimals;
  }

  const donations = [];
  for (const item of incoming) {
    const rawAmount = parseRawAmount(item);
    if (rawAmount === null || rawAmount === undefined) {
      state.diagnostics.notes.push("Skipped transfer with missing amount.");
      continue;
    }
    const amount = convertAmount(rawAmount, decimals);
    if (!Number.isFinite(amount)) {
      state.diagnostics.notes.push("Skipped transfer with invalid amount.");
      continue;
    }
    const tx = getTxId(item);
    if (!tx) {
      state.diagnostics.notes.push("Skipped transfer with missing tx hash.");
      continue;
    }
    donations.push({
      amount,
      timestamp: parseTimestamp(item),
      tx,
      from: getFromAddress(item),
    });
  }

  donations.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalRaised = donations.reduce((sum, d) => sum + (Number.isFinite(d.amount) ? d.amount : 0), 0);

  return { donations, totalRaised };
}

function renderDonations(donations) {
  const list = donations.slice(0, CONFIG.DONATIONS_LIST_LIMIT);
  elements.donationsList.innerHTML = "";

  if (list.length === 0) {
    elements.donationEmpty.style.display = "block";
    return;
  }

  elements.donationEmpty.style.display = "none";

  for (const item of list) {
    const row = document.createElement("div");
    row.className = "table-row";

    const fromText = CONFIG.SHOW_DONOR_ADDRESSES ? shortAddress(item.from) : "Anonymous";
    const fromLink = item.from ? buildWalletUrlFor(item.from) : "#";

    row.innerHTML = `
      <span>${formatUSDT(item.amount)} USDT</span>
      <a href="${fromLink}" target="_blank" rel="noopener">${fromText}</a>
      <span>${formatDateUtc(item.timestamp)}</span>
      <a href="${buildTxUrl(item.tx)}" target="_blank" rel="noopener">View TX</a>
    `;

    elements.donationsList.appendChild(row);
  }
}

function renderSummary(totalRaised) {
  updateProgress(totalRaised);
}

function renderMiniFeed(donations, hasError) {
  renderLiveFeed(donations, hasError);
}

function renderLiveFeed(donations, hasError) {
  const list = donations.slice(0, FEED_LIMIT);
  elements.feedList.innerHTML = "";

  if (hasError) {
    elements.feedEmpty.textContent = "Live data temporarily unavailable. Please verify on Tronscan.";
    elements.feedEmpty.style.display = "block";
    return;
  }

  if (list.length === 0) {
    elements.feedEmpty.textContent = "No donations yet. Be the first to support the listing fee!";
    elements.feedEmpty.style.display = "block";
    return;
  }

  elements.feedEmpty.style.display = "none";

  for (const item of list) {
    const row = document.createElement("div");
    row.className = "feed-item";

    const fromText = CONFIG.SHOW_DONOR_ADDRESSES ? shortAddress(item.from) : "Anonymous";
    const fromLink = item.from ? buildWalletUrlFor(item.from) : "#";
    const timeText = timeAgo(item.timestamp);

    const txLabel = item.tx ? shortTx(item.tx) : "TX";
    row.innerHTML = `
      <span class="feed-amount">${formatUSDT(item.amount)} USDT</span>
      <a class="feed-from" href="${fromLink}" target="_blank" rel="noopener">${fromText}</a>
      <span class="feed-time">${timeText}</span>
      <a class="feed-link" href="${buildTxUrl(item.tx)}" target="_blank" rel="noopener">${txLabel}</a>
    `;

    elements.feedList.appendChild(row);
  }
}

function updateLastUpdated() {
  const now = new Date();
  elements.lastUpdated.textContent = formatChicago(now, true);
}

function updateDelayWarning(transfers, donations, latestTx) {
  if (!elements.tronscanDelay) return;
  if (!Array.isArray(transfers) || transfers.length === 0) {
    elements.tronscanDelay.hidden = true;
    return;
  }

  if (donations.length > 0) {
    elements.tronscanDelay.hidden = true;
    return;
  }

  if (elements.delayWalletLink) {
    elements.delayWalletLink.href = buildWalletUrl();
  }
  let latestTransfer = null;
  for (const item of transfers) {
    const ts = parseTimestamp(item) || 0;
    if (!latestTransfer || ts > latestTransfer.ts) {
      latestTransfer = { ts, tx: getTxId(item) };
    }
  }

  const txToShow = latestTx || latestTransfer?.tx;
  if (elements.delayTxLink) {
    elements.delayTxLink.textContent = txToShow ? `Latest tx ${shortTx(txToShow)}` : "Latest tx";

    if (txToShow) {
      elements.delayTxLink.href = buildTxUrl(txToShow);
      elements.delayTxLink.classList.remove("disabled");
      elements.delayTxLink.setAttribute("aria-disabled", "false");
    } else {
      elements.delayTxLink.href = "#";
      elements.delayTxLink.classList.add("disabled");
      elements.delayTxLink.setAttribute("aria-disabled", "true");
    }
  }

  elements.tronscanDelay.hidden = false;
}

async function refresh() {
  refreshTick += 1;
  setHeartbeat(`Heartbeat: refresh #${refreshTick} started - ${nowChicago()}`);
  state.diagnostics.attempts = [];
  state.diagnostics.notes = [];
  state.diagnostics.query = "running";
  state.diagnostics.lastFetch = nowChicago();
  state.diagnostics.httpStatus = "pending";
  state.diagnostics.records = 0;
  state.diagnostics.incoming = 0;
  state.diagnostics.error = "none";
  updateLastUpdated();
  updateDataRecords(0);
  updateDiagnosticsUI();

  let configError = "";
  if (!CONFIG.TRON_ADDRESS) {
    configError = "Fatal: wallet address missing in config. Live data disabled.";
    state.diagnostics.error = "Missing TRON_ADDRESS in config.";
  }
  if (!isProxyConfigured()) {
    configError = "Proxy not configured - live donations cannot load. Configure PROXY_BASE.";
    state.diagnostics.error = "Proxy base not configured.";
  }
  if (configError) {
    showErrorBanner(configError);
    showProxyBanner(true);
    setDataSource("Proxy", "not configured");
    updateProgress(0);
    renderDonations([]);
    renderMiniFeed([], true);
  } else {
    showErrorBanner("");
  }

  try {
    showProxyBanner(!isProxyConfigured());
    const { transfers, source, status, base } = await fetchTransfers();
    const isProxySource = source === "Proxy";
    const { donations, totalRaised } = prepareDonations(transfers, isProxySource);
    const latestTx = donations[0]?.tx;
    const knownTx = getKnownTxHashes()[0] || "";

    renderSummary(totalRaised);
    renderDonations(donations);
    renderMiniFeed(donations, false);
    updateDelayWarning(transfers, donations, latestTx || knownTx);
    updateKnownTxNotice(transfers, false);
    setLatestTxState(latestTx, donations.length ? "" : "No donations detected from API");
    setDataSource(source, base || "not configured");
    state.diagnostics.httpStatus = status ? `HTTP ${status}` : "pending";
    state.diagnostics.records = transfers.length;
    state.diagnostics.incoming = donations.length;
    updateDataRecords(state.diagnostics.records);
    state.diagnostics.error = "";
  } catch (error) {
    console.error("[fundraiser] refresh error", error);
    const status = error?.status;
    const statusNote = status ? ` (HTTP ${status})` : "";
    const corsNote = error?.name === "TypeError" && !status ? " (CORS blocked)" : "";
    let upstreamSnippet = "";
    if (error?.body) {
      try {
        const parsed = JSON.parse(error.body);
        if (parsed?.upstreamSnippet) upstreamSnippet = parsed.upstreamSnippet;
      } catch {
        upstreamSnippet = error.body;
      }
    }
    const hint = status === 400 ? " Check confirm param: must be 0/1/0,1 not true/false." : "";
    const detail = error?.message ? ` Details: ${error.message}` : "";
    showErrorBanner(`Live data may be delayed or rate-limited. Verify on Tronscan.${statusNote}${corsNote}${detail}${hint}`);
    if (!isProxyConfigured()) {
      showProxyBanner(true);
    }
    updateProgress(0);
    renderDonations([]);
    renderMiniFeed([], true);
    updateDelayWarning([], [], null);
    updateKnownTxNotice([], true);
    setLatestTxState(null, "API unavailable");
    setDataSource("Proxy", getProxyBase() || "not configured");
    state.diagnostics.httpStatus = "error";
    state.diagnostics.records = 0;
    state.diagnostics.incoming = 0;
    updateDataRecords(0);
    const snippetText = upstreamSnippet ? ` Upstream: ${upstreamSnippet}` : "";
    const errText = error?.stack || error?.message || String(error);
    state.diagnostics.error = `${errText}${snippetText}${hint}`;
  } finally {
    state.diagnostics.query = "done";
    updateDiagnosticsUI();
    setHeartbeat(
      `Heartbeat: refresh #${refreshTick} done - status=${state.diagnostics.httpStatus} - records=${state.diagnostics.records} - ${nowChicago()}`
    );
  }
}

function setupCopy() {
  if (!elements.copyButton) return;
  elements.copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.TRON_ADDRESS);
      elements.copyButton.textContent = "Copied";
      setTimeout(() => {
        elements.copyButton.textContent = "Copy";
      }, 1200);
    } catch {
      elements.copyButton.textContent = "Copy";
    }
  });
}

function setupQr() {
  if (!elements.qrCanvas) return;
  const qr = qrcode(0, "M");
  qr.addData(CONFIG.TRON_ADDRESS);
  qr.make();

  const canvas = elements.qrCanvas;
  const ctx = canvas.getContext("2d");
  const moduleCount = qr.getModuleCount();
  const cellSize = 6;
  const size = moduleCount * cellSize;
  const scale = window.devicePixelRatio || 1;

  canvas.width = size * scale;
  canvas.height = size * scale;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";

  for (let r = 0; r < moduleCount; r += 1) {
    for (let c = 0; c < moduleCount; c += 1) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }
}

function initConfig() {
  console.log("[fundraiser] API_MODE =", CONFIG.API_MODE, "PROXY_BASE =", CONFIG.PROXY_BASE);
  if (!CONFIG.TRON_ADDRESS) {
    showErrorBanner("Fatal: wallet address missing in config. Live data disabled.");
    state.diagnostics.error = "Missing TRON_ADDRESS in config.";
    updateDiagnosticsUI();
  }
  if (elements.addressText) {
    elements.addressText.textContent = CONFIG.TRON_ADDRESS || "Address missing";
  }
  if (elements.verifyWalletBtn) {
    elements.verifyWalletBtn.href = buildWalletUrl();
  }
  if (elements.latestTxBtn) {
    elements.latestTxBtn.href = "#";
    elements.latestTxBtn.addEventListener("click", (event) => {
      if (elements.latestTxBtn.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      const original = elements.latestTxBtn.textContent;
      elements.latestTxBtn.textContent = "Opening...";
      setTimeout(() => {
        elements.latestTxBtn.textContent = original;
      }, 800);
    });
  }
  if (elements.knownTxButton) {
    elements.knownTxButton.addEventListener("click", (event) => {
      event.preventDefault();
      const tx = elements.knownTxButton.dataset.tx || getKnownTxHashes()[0];
      if (tx) {
        openInNewTab(buildTxUrl(tx), elements.knownTxButton);
      }
    });
  }
  if (elements.diagnosticsToggle && elements.diagnosticsPanel) {
    elements.diagnosticsToggle.addEventListener("click", () => {
      const isHidden = elements.diagnosticsPanel.hidden;
      elements.diagnosticsPanel.hidden = !isHidden;
      elements.diagnosticsToggle.setAttribute("aria-expanded", String(isHidden));
    });
  }
  if (elements.copyDiagnostics) {
    elements.copyDiagnostics.addEventListener("click", async () => {
      try {
        await copyDiagnosticsToClipboard();
        elements.copyDiagnostics.textContent = "Copied";
        setTimeout(() => {
          elements.copyDiagnostics.textContent = "Copy diagnostics";
        }, 1200);
      } catch {
        elements.copyDiagnostics.textContent = "Copy diagnostics";
      }
    });
  }
  if (elements.debugLink) {
    elements.debugLink.hidden = !shouldShowDebugLink();
  }
  if (elements.refreshSeconds) {
    elements.refreshSeconds.textContent = String(CONFIG.REFRESH_SECONDS);
  }
  if (elements.feedRefreshSeconds) {
    elements.feedRefreshSeconds.textContent = String(CONFIG.REFRESH_SECONDS);
  }
  const initialBase = getProxyBase();
  setDataSource("Proxy", initialBase || "not configured");
  setLatestTxState(null, "No donations detected from API");
  showProxyBanner(!isProxyConfigured());
  updateDeadline();
  updateProgress(0);
  updateDataRecords(0);
  updateLastUpdated();
  setupCopy();
  setupQr();

  if (elements.refreshButton) {
    elements.refreshButton.addEventListener("click", refresh);
  }
}

/* QR Code generator (MIT License) based on qrcode-generator by Kazuhiko Arase. */
function qrcode(typeNumber, errorCorrectionLevel) {
  const PAD0 = 0xEC;
  const PAD1 = 0x11;
  const _typeNumber = typeNumber;
  const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  const _qr = new QRCodeModel(_typeNumber, _errorCorrectionLevel);

  return {
    addData: (data) => _qr.addData(data),
    make: () => _qr.make(),
    getModuleCount: () => _qr.getModuleCount(),
    isDark: (row, col) => _qr.isDark(row, col),
  };
}

const QRMode = {
  MODE_8BIT_BYTE: 1 << 2,
};

const QRErrorCorrectionLevel = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

const QRMaskPattern = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7,
};

class QRCodeModel {
  constructor(typeNumber, errorCorrectionLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  addData(data) {
    const newData = new QR8bitByte(data);
    this.dataList.push(newData);
    this.dataCache = null;
  }

  isDark(row, col) {
    if (this.modules[row][col] !== null) {
      return this.modules[row][col];
    }
    return false;
  }

  getModuleCount() {
    return this.moduleCount;
  }

  make() {
    if (this.typeNumber < 1) {
      this.typeNumber = this.getBestTypeNumber();
    }
    this.makeImpl(false, this.getBestMaskPattern());
  }

  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row += 1) {
      this.modules[row] = new Array(this.moduleCount);
      for (let col = 0; col < this.moduleCount; col += 1) {
        this.modules[row][col] = null;
      }
    }

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);

    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test);
    }

    if (this.dataCache === null) {
      this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
    }

    this.mapData(this.dataCache, maskPattern);
  }

  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c === 0 || c === 6)) || (0 <= c && c <= 6 && (r === 0 || r === 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  getBestMaskPattern() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i += 1) {
      this.makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(this);
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }

  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r += 1) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c += 1) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(this.typeNumber);
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  setupTypeNumber(test) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  setupTypeInfo(test, maskPattern) {
    const data = (this.errorCorrectionLevel << 3) | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);

    for (let i = 0; i < 15; i += 1) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) {
        this.modules[i][8] = mod;
      } else if (i < 8) {
        this.modules[i + 1][8] = mod;
      } else {
        this.modules[this.moduleCount - 15 + i][8] = mod;
      }
    }

    for (let i = 0; i < 15; i += 1) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = mod;
      } else if (i < 9) {
        this.modules[8][15 - i - 1 + 1] = mod;
      } else {
        this.modules[8][15 - i - 1] = mod;
      }
    }

    this.modules[this.moduleCount - 8][8] = !test;
  }

  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;

      while (true) {
        for (let c = 0; c < 2; c += 1) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            const mask = QRUtil.getMask(maskPattern, row, col - c);
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex -= 1;
            if (bitIndex === -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  getBestTypeNumber() {
    for (let type = 1; type < 10; type += 1) {
      const rsBlocks = QRRSBlock.getRSBlocks(type, this.errorCorrectionLevel);
      const buffer = new QRBitBuffer();
      for (let i = 0; i < this.dataList.length; i += 1) {
        const data = this.dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, type));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() <= totalDataCount * 8) {
        return type;
      }
    }
    return 10;
  }

  static createData(typeNumber, errorCorrectionLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
    const buffer = new QRBitBuffer();

    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    }

    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount;
    }

    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error("Code length overflow");
    }

    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }

    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(false);
    }

    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }

    return QRCodeModel.createBytes(buffer, rsBlocks);
  }

  static createBytes(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;

    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);

    for (let r = 0; r < rsBlocks.length; r += 1) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;

      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);

      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      }
      offset += dcCount;

      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);

      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
      }
    }

    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalCodeCount += rsBlocks[i].totalCount;
    }

    const data = new Array(totalCodeCount);
    let index = 0;

    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) {
          data[index] = dcdata[r][i];
          index += 1;
        }
      }
    }

    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) {
          data[index] = ecdata[r][i];
          index += 1;
        }
      }
    }

    return data;
  }
}

class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }

  get(index) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }

  put(num, length) {
    for (let i = 0; i < length; i += 1) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  getLengthInBits() {
    return this.length;
  }

  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length += 1;
  }
}

class QR8bitByte {
  constructor(data) {
    this.mode = QRMode.MODE_8BIT_BYTE;
    this.data = data;
  }

  getLength() {
    return this.data.length;
  }

  write(buffer) {
    for (let i = 0; i < this.data.length; i += 1) {
      buffer.put(this.data.charCodeAt(i), 8);
    }
  }
}

class QRPolynomial {
  constructor(num, shift) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) {
      offset += 1;
    }
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i += 1) {
      this.num[i] = num[i + offset];
    }
  }

  getAt(index) {
    return this.num[index];
  }

  getLength() {
    return this.num.length;
  }

  multiply(e) {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i += 1) {
      for (let j = 0; j < e.getLength(); j += 1) {
        num[i + j] ^= QRUtil.gexp(QRUtil.glog(this.getAt(i)) + QRUtil.glog(e.getAt(j)));
      }
    }
    return new QRPolynomial(num, 0);
  }

  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;

    const ratio = QRUtil.glog(this.getAt(0)) - QRUtil.glog(e.getAt(0));
    const num = this.num.slice();

    for (let i = 0; i < e.getLength(); i += 1) {
      num[i] ^= QRUtil.gexp(QRUtil.glog(e.getAt(i)) + ratio);
    }

    return new QRPolynomial(num, 0).mod(e);
  }
}

const QRRSBlock = {
  getRSBlocks(typeNumber, errorCorrectionLevel) {
    const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (rsBlock === undefined) {
      throw new Error("RS block not found");
    }

    const length = rsBlock.length / 3;
    const list = [];

    for (let i = 0; i < length; i += 1) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];

      for (let j = 0; j < count; j += 1) {
        list.push({ totalCount, dataCount });
      }
    }

    return list;
  },

  getRsBlockTable(typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L:
        return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M:
        return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q:
        return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H:
        return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default:
        return undefined;
    }
  },

  RS_BLOCK_TABLE: [
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
  ],
};

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
  ],

  G15: 0x0537,
  G18: 0x1f25,
  G15_MASK: 0x5412,

  getBCHTypeInfo(data) {
    let d = data << 10;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
      d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15));
    }
    return ((data << 10) | d) ^ QRUtil.G15_MASK;
  },

  getBCHTypeNumber(data) {
    let d = data << 12;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
      d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18));
    }
    return (data << 12) | d;
  },

  getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  },

  getPatternPosition(typeNumber) {
    return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
  },

  getMask(maskPattern, i, j) {
    switch (maskPattern) {
      case QRMaskPattern.PATTERN000:
        return (i + j) % 2 === 0;
      case QRMaskPattern.PATTERN001:
        return i % 2 === 0;
      case QRMaskPattern.PATTERN010:
        return j % 3 === 0;
      case QRMaskPattern.PATTERN011:
        return (i + j) % 3 === 0;
      case QRMaskPattern.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case QRMaskPattern.PATTERN101:
        return ((i * j) % 2) + ((i * j) % 3) === 0;
      case QRMaskPattern.PATTERN110:
        return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case QRMaskPattern.PATTERN111:
        return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
      default:
        return false;
    }
  },

  getErrorCorrectPolynomial(errorCorrectLength) {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      a = a.multiply(new QRPolynomial([1, QRUtil.gexp(i)], 0));
    }
    return a;
  },

  getLengthInBits(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case QRMode.MODE_8BIT_BYTE:
          return 8;
        default:
          return 8;
      }
    }
    return 8;
  },

  getLostPoint(qrCode) {
    const moduleCount = qrCode.getModuleCount();
    let lostPoint = 0;

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        let sameCount = 0;
        const dark = qrCode.isDark(row, col);
        for (let r = -1; r <= 1; r += 1) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c += 1) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === qrCode.isDark(row + r, col + c)) sameCount += 1;
          }
        }
        if (sameCount > 5) {
          lostPoint += 3 + sameCount - 5;
        }
      }
    }

    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        let count = 0;
        if (qrCode.isDark(row, col)) count += 1;
        if (qrCode.isDark(row + 1, col)) count += 1;
        if (qrCode.isDark(row, col + 1)) count += 1;
        if (qrCode.isDark(row + 1, col + 1)) count += 1;
        if (count === 0 || count === 4) {
          lostPoint += 3;
        }
      }
    }

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (
          qrCode.isDark(row, col) &&
          !qrCode.isDark(row, col + 1) &&
          qrCode.isDark(row, col + 2) &&
          qrCode.isDark(row, col + 3) &&
          qrCode.isDark(row, col + 4) &&
          !qrCode.isDark(row, col + 5) &&
          qrCode.isDark(row, col + 6)
        ) {
          lostPoint += 40;
        }
      }
    }

    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (
          qrCode.isDark(row, col) &&
          !qrCode.isDark(row + 1, col) &&
          qrCode.isDark(row + 2, col) &&
          qrCode.isDark(row + 3, col) &&
          qrCode.isDark(row + 4, col) &&
          !qrCode.isDark(row + 5, col) &&
          qrCode.isDark(row + 6, col)
        ) {
          lostPoint += 40;
        }
      }
    }

    let darkCount = 0;
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qrCode.isDark(row, col)) darkCount += 1;
      }
    }

    const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;

    return lostPoint;
  },

  gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRUtil.EXP_TABLE[n];
  },

  glog(n) {
    if (n < 1) throw new Error("glog");
    return QRUtil.LOG_TABLE[n];
  },

  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256),
};

for (let i = 0; i < 8; i += 1) {
  QRUtil.EXP_TABLE[i] = 1 << i;
}
for (let i = 8; i < 256; i += 1) {
  QRUtil.EXP_TABLE[i] = QRUtil.EXP_TABLE[i - 4] ^ QRUtil.EXP_TABLE[i - 5] ^ QRUtil.EXP_TABLE[i - 6] ^ QRUtil.EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i += 1) {
  QRUtil.LOG_TABLE[QRUtil.EXP_TABLE[i]] = i;
}

function boot() {
  try {
    initConfig();
    setDiagnostics("booted");
    setHeartbeat(`Heartbeat: boot() OK - BUILD ${BUILD_ID} - ${nowChicago()}`);
    console.log(`[fundraiser] Heartbeat: boot() OK - BUILD ${BUILD_ID} - ${nowChicago()}`);
    refresh();
    clearInterval(window.__fundraiserTimer);
    window.__fundraiserTimer = setInterval(refresh, CONFIG.REFRESH_SECONDS * 1000);
  } catch (error) {
    console.error("[fundraiser] boot error", error);
    state.diagnostics.error = error?.stack || error?.message || String(error);
    state.diagnostics.httpStatus = "error";
    updateDiagnosticsUI();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

