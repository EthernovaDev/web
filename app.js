const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  "ChainId: 77777",
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
