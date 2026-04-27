const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Simple markdown to HTML converter for release notes
const renderMarkdown = (md) => {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Close list if current line is not a list item
    if (inList && !/^\s*-\s/.test(line)) {
      html += "</ul>";
      inList = false;
    }

    // Blank line
    if (!line.trim()) {
      html += "";
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${inline(esc(headingMatch[2]))}</h${level}>`;
      continue;
    }

    // List items
    const listMatch = line.match(/^\s*-\s+(.*)/);
    if (listMatch) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(esc(listMatch[1]))}</li>`;
      continue;
    }

    // Regular paragraph
    html += `<p>${inline(esc(line))}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
};

// Inline formatting: bold, code, links
const inline = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

// Auto-fetch latest release from GitHub
(async () => {
  try {
    const res = await fetch("https://api.github.com/repos/EthernovaDev/ethernova-coregeth/releases/latest");
    if (!res.ok) return;
    const data = await res.json();
    const tag = data.tag_name;
    if (!tag) return;

    const heroVersion = document.getElementById("latest-version");
    if (heroVersion) heroVersion.textContent = tag;

    const upgradeVersion = document.getElementById("upgrade-version");
    if (upgradeVersion) upgradeVersion.textContent = tag;

    document.querySelectorAll(".release-version").forEach((el) => {
      el.textContent = tag;
    });

    const upgradeBody = document.getElementById("upgrade-body");
    if (upgradeBody && data.body) {
      upgradeBody.innerHTML = renderMarkdown(data.body);
    }

    const downloadLink = document.getElementById("upgrade-download");
    if (downloadLink && data.html_url) {
      downloadLink.href = data.html_url;
    }
  } catch (_) {
    // Fallback to hardcoded version
  }
})();

const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-links a[data-scroll]");
const scrollLinks = document.querySelectorAll("[data-scroll]");

const closeNav = () => {
  if (!header || !navToggle) {
    return;
  }
  header.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
};

if (navToggle && header) {
  navToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!header.classList.contains("nav-open")) {
      return;
    }
    if (!header.contains(event.target)) {
      closeNav();
    }
  });
}

scrollLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) {
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        closeNav();
      }
    }
  });
});

const sections = document.querySelectorAll("main section[id]");

const setActiveLink = (id) => {
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === `#${id}`;
    link.classList.toggle("active", isActive);
  });
};

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveLink(entry.target.id);
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

const toast = document.querySelector(".toast");
let toastTimer = null;

const showToast = (message) => {
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
};

const fallbackCopy = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const copyText = async (text) => {
  if (!text) {
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    showToast("Copied!");
  } catch (error) {
    fallbackCopy(text);
    showToast("Copied!");
  }
};

const copyButtons = document.querySelectorAll("[data-copy]");
copyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copy);
  });
});

const metaMaskConfig = [
  "Network Name: Ethernova",
  "RPC: https://rpc.ethnova.net",
  "ChainId: 121525",
  "Symbol: NOVA",
  "Explorer: https://explorer.ethnova.net",
].join("\n");

const metaMaskButton = document.querySelector("[data-copy-metamask]");
if (metaMaskButton) {
  metaMaskButton.addEventListener("click", () => {
    copyText(metaMaskConfig);
  });
}

const heroArt = document.querySelector(".hero-art");
if (heroArt && !prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener("mousemove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;
    heroArt.style.setProperty("--parallax-x", `${x}px`);
    heroArt.style.setProperty("--parallax-y", `${y}px`);
  });
}

const starfield = document.getElementById("starfield");
if (starfield) {
  const ctx = starfield.getContext("2d");
  let width = 0;
  let height = 0;
  let stars = [];

  const buildStars = () => {
    const count = Math.min(260, Math.floor((width * height) / 4500));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.3 + 0.3,
      alpha: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.15 + 0.03,
    }));
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    starfield.width = width * dpr;
    starfield.height = height * dpr;
    starfield.style.width = `${width}px`;
    starfield.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  };

  const render = () => {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      if (!prefersReducedMotion) {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      }
    }
    ctx.globalAlpha = 1;
    if (!prefersReducedMotion) {
      requestAnimationFrame(render);
    }
  };

  resize();
  render();
  window.addEventListener("resize", () => {
    resize();
    if (prefersReducedMotion) {
      render();
    }
  });
}

// Fetch NOVA price from Gatevia + KlingEx + supply from stats API.
// Refresh periodically so the exchange card does not look frozen.
(() => {
  const priceEl = document.getElementById("nova-price");
  const volumeEl = document.getElementById("nova-volume");
  const mcapEl = document.getElementById("nova-mcap");
  const statusEl = document.getElementById("nova-market-status");
  const marketCard = document.querySelector(".market-card");
  if (!priceEl) return;

  const dash = "—";
  const refreshMs = 60000;
  let hasLoadedOnce = false;

  const parsePositiveNumber = (value) => {
    const number = parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };

  const setStatus = (message, state) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-live", state === "live");
    statusEl.classList.toggle("is-stale", state === "stale");
  };

  const setRefreshing = (isRefreshing) => {
    if (!marketCard) return;
    marketCard.classList.toggle("is-refreshing", isRefreshing);
  };

  const updateMarketStats = async () => {
    if (!hasLoadedOnce) {
      setStatus("Loading live market data...", "loading");
    } else {
      setStatus("Refreshing live market data...", "loading");
    }
    setRefreshing(true);

    try {
      const [gateviaRes, klingexRes, statsRes] = await Promise.all([
        fetch("https://api.gatevia.io/public/markets/NOVA_USDT/tickers", { cache: "no-store" }).catch(() => null),
        fetch("https://api.ethnova.net/klingex.json", { cache: "no-store" }).catch(() => null),
        fetch("https://api.ethnova.net/stats.json", { cache: "no-store" }).catch(() => null),
      ]);

      const prices = [];
      let totalVolume = 0;

      if (gateviaRes && gateviaRes.ok) {
        const gatevia = await gateviaRes.json();
        const last = parsePositiveNumber(gatevia?.ticker?.last ?? gatevia?.last ?? gatevia?.last_price);
        const volume = parsePositiveNumber(gatevia?.ticker?.volume ?? gatevia?.volume ?? gatevia?.base_volume);
        if (last) prices.push(last);
        if (volume) totalVolume += volume;
      }

      if (klingexRes && klingexRes.ok) {
        const klingex = await klingexRes.json();
        const isNovaMarket = !klingex?.ticker_id || klingex.ticker_id === "NOVA_USDT";
        if (isNovaMarket) {
          const last = parsePositiveNumber(klingex.last_price ?? klingex.last);
          const volume = parsePositiveNumber(klingex.base_volume ?? klingex.volume);
          if (last) prices.push(last);
          if (volume) totalVolume += volume;
        }
      }

      const price = prices.length > 0
        ? prices.reduce((total, current) => total + current, 0) / prices.length
        : null;

      priceEl.textContent = price ? "$" + price.toFixed(8) : dash;
      volumeEl.textContent = totalVolume > 0
        ? totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " NOVA"
        : dash;

      if (price && statsRes && statsRes.ok) {
        const stats = await statsRes.json();
        const supply = parsePositiveNumber(stats?.minedCoins);
        mcapEl.textContent = supply
          ? "$" + (price * supply).toLocaleString(undefined, { maximumFractionDigits: 2 })
          : dash;
      } else {
        mcapEl.textContent = dash;
      }

      hasLoadedOnce = true;
      setStatus(
        `Live market data · Updated ${new Date().toLocaleTimeString()} · refreshes every 60s`,
        "live"
      );
    } catch (_) {
      if (!hasLoadedOnce) {
        priceEl.textContent = dash;
        volumeEl.textContent = dash;
        mcapEl.textContent = dash;
      }
      setStatus("Market data is temporarily unavailable. Retrying automatically.", "stale");
    } finally {
      setRefreshing(false);
    }
  };

  updateMarketStats();
  window.setInterval(updateMarketStats, refreshMs);
})();
