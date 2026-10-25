const year = document.querySelector("#year");
const copyButton = document.querySelector(".copy-button");
const copyStatus = document.querySelector(".copy-status");
const siteHeader = document.querySelector("[data-site-header]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");
const navLinks = [...document.querySelectorAll("[data-nav-section]")];
const navSections = navLinks
  .map((link) => document.querySelector(`#${link.dataset.navSection}`))
  .filter(Boolean);

year.textContent = new Date().getFullYear();

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const anchorLinks = [...document.querySelectorAll('a[href^="#"]')];
const anchorOffset = 88;
let anchorAnimationFrame = 0;

const resolveAnchorElement = (target) =>
  target.querySelector(".section-heading, .contact-top") ?? target;

const getLayoutTop = (element) => {
  const transformValue = window.getComputedStyle(element).transform;
  const transformOffset =
    transformValue === "none"
      ? 0
      : new DOMMatrixReadOnly(transformValue).m42;

  return (
    element.getBoundingClientRect().top +
    window.scrollY -
    transformOffset
  );
};

const cancelAnchorAnimation = () => {
  if (!anchorAnimationFrame) return;
  window.cancelAnimationFrame(anchorAnimationFrame);
  anchorAnimationFrame = 0;
};

const dampedScrollToY = (requestedTargetY) => {
  cancelAnchorAnimation();

  const maxScrollY = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const targetY = Math.min(
    maxScrollY,
    Math.max(0, requestedTargetY),
  );

  if (reducedMotion) {
    window.scrollTo(0, targetY);
    return;
  }

  let position = window.scrollY;
  let velocity = 0;
  let previousTime = performance.now();
  const omega = 2 / 0.5;

  const step = (time) => {
    const delta = Math.min((time - previousTime) / 1000, 1 / 30);
    previousTime = time;

    const displacement = targetY - position;
    const acceleration =
      omega * omega * displacement - 2 * omega * velocity;

    velocity += acceleration * delta;
    position += velocity * delta;
    window.scrollTo(0, position);

    if (Math.abs(displacement) < 0.5 && Math.abs(velocity) < 0.5) {
      window.scrollTo(0, targetY);
      anchorAnimationFrame = 0;
      return;
    }

    anchorAnimationFrame = window.requestAnimationFrame(step);
  };

  anchorAnimationFrame = window.requestAnimationFrame(step);
}

const dampedScrollTo = (target) => {
  const anchor = resolveAnchorElement(target);
  const targetY = anchor.classList.contains("hero")
    ? 0
    : getLayoutTop(anchor) - anchorOffset;

  dampedScrollToY(targetY);
};

anchorLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      link.classList.contains("skip-link") ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    history.pushState(null, "", link.getAttribute("href"));
    dampedScrollTo(target);
  });
});

window.addEventListener(
  "wheel",
  cancelAnchorAnimation,
  { passive: true },
);
window.addEventListener(
  "touchstart",
  cancelAnchorAnimation,
  { passive: true },
);

const initialAnchor = location.hash.length > 1
  ? document.querySelector(location.hash)
  : null;

if (initialAnchor) {
  window.requestAnimationFrame(() => dampedScrollTo(initialAnchor));
}

const hero = document.querySelector(".hero");
const gridCanvas = document.querySelector(".hero-grid-canvas");
const finePointer = window.matchMedia("(pointer: fine)").matches;

if (hero && gridCanvas) {
  const context = gridCanvas.getContext("2d");
  const gridState = {
    width: 0,
    height: 0,
    dpr: 1,
    pointerX: 0,
    pointerY: 0,
    strength: 0,
    targetStrength: 0,
    frame: 0,
    previousFrameTime: 0,
    previousX: 0,
    previousY: 0,
    previousPointerTime: 0,
  };

  const minorSpacing = 48;
  const majorSpacing = 192;

  const getWarpedPoint = (x, y) => {
    if (gridState.strength < 0.001) return { x, y };

    const deltaX = x - gridState.pointerX;
    const deltaY = y - gridState.pointerY;
    const distance = Math.hypot(deltaX, deltaY);
    const radius = Math.min(
      250,
      Math.max(165, Math.min(gridState.width, gridState.height) * 0.25),
    );

    if (distance > radius) return { x, y };
    if (distance < 0.01) {
      return { x: gridState.pointerX, y: gridState.pointerY };
    }

    const normalizedDistance = distance / radius;
    const smoothFalloff =
      (1 - normalizedDistance) ** 2 *
      (3 - 2 * (1 - normalizedDistance));
    const falloff = smoothFalloff * gridState.strength;
    const angle =
      Math.atan2(deltaY, deltaX) + falloff * 0.68;
    const bend =
      Math.sin(normalizedDistance * Math.PI) * falloff * 30;
    const warpedDistance = distance + bend;

    return {
      x: gridState.pointerX + Math.cos(angle) * warpedDistance,
      y: gridState.pointerY + Math.sin(angle) * warpedDistance,
    };
  };

  const drawGridLine = (isVertical, position, isMajor) => {
    const lineLength = isVertical ? gridState.height : gridState.width;
    const sample = isMajor ? 8 : 12;

    context.beginPath();

    for (let point = 0; point <= lineLength + sample; point += sample) {
      const x = isVertical ? position : point;
      const y = isVertical ? point : position;
      const warped = getWarpedPoint(x, y);

      if (point === 0) context.moveTo(warped.x, warped.y);
      else context.lineTo(warped.x, warped.y);
    }

    context.strokeStyle = isMajor
      ? "rgba(10, 83, 104, 0.17)"
      : "rgba(10, 83, 104, 0.095)";
    context.lineWidth = isMajor ? 0.9 : 0.65;
    context.stroke();
  };

  const drawGrid = () => {
    if (!context || !gridState.width || !gridState.height) return;

    context.clearRect(0, 0, gridState.width, gridState.height);

    for (let x = 0; x <= gridState.width; x += minorSpacing) {
      drawGridLine(true, x, x % majorSpacing === 0);
    }

    for (let y = 0; y <= gridState.height; y += minorSpacing) {
      drawGridLine(false, y, y % majorSpacing === 0);
    }
  };

  const animateGrid = (time) => {
    const elapsed = Math.min(
      Math.max((time - gridState.previousFrameTime) / 1000, 0),
      0.05,
    );
    gridState.previousFrameTime = time;
    const easing = 1 - Math.exp(-elapsed * 13);

    gridState.strength +=
      (gridState.targetStrength - gridState.strength) * easing;
    drawGrid();

    const isSettled =
      Math.abs(gridState.targetStrength - gridState.strength) < 0.004;

    if (isSettled) {
      gridState.strength = gridState.targetStrength;
      drawGrid();
      hero.classList.toggle(
        "grid-is-active",
        gridState.targetStrength > 0.01,
      );
      gridState.frame = 0;
      return;
    }

    gridState.frame = window.requestAnimationFrame(animateGrid);
  };

  const startGridAnimation = () => {
    if (gridState.frame) return;
    gridState.previousFrameTime = performance.now();
    gridState.frame = window.requestAnimationFrame(animateGrid);
  };

  const resizeGrid = () => {
    if (!context) return;

    const bounds = hero.getBoundingClientRect();
    gridState.width = Math.max(1, Math.round(bounds.width));
    gridState.height = Math.max(1, Math.round(bounds.height));
    gridState.dpr = Math.min(window.devicePixelRatio || 1, 2);
    gridCanvas.width = Math.round(gridState.width * gridState.dpr);
    gridCanvas.height = Math.round(gridState.height * gridState.dpr);
    context.setTransform(
      gridState.dpr,
      0,
      0,
      gridState.dpr,
      0,
      0,
    );
    drawGrid();
  };

  resizeGrid();
  new ResizeObserver(resizeGrid).observe(hero);

  if (finePointer && !reducedMotion) {
    hero.addEventListener("pointerenter", (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;

      gridState.pointerX = x;
      gridState.pointerY = y;
      gridState.previousX = x;
      gridState.previousY = y;
      gridState.previousPointerTime = performance.now();
      gridState.targetStrength = 0.36;
      hero.classList.add("grid-is-active");
      startGridAnimation();
    });

    hero.addEventListener("pointermove", (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const time = performance.now();
      const elapsed = Math.max(time - gridState.previousPointerTime, 8);
      const speed =
        Math.hypot(x - gridState.previousX, y - gridState.previousY) /
        elapsed;

      gridState.pointerX = x;
      gridState.pointerY = y;
      gridState.previousX = x;
      gridState.previousY = y;
      gridState.previousPointerTime = time;
      gridState.targetStrength = Math.min(1, 0.52 + speed * 0.8);
      startGridAnimation();
    });

    hero.addEventListener("pointerleave", () => {
      gridState.targetStrength = 0;
      startGridAnimation();
    });
  }
}

if (reducedMotion || !("IntersectionObserver" in window)) {
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("is-visible");
  });
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
  );

  document.querySelectorAll(".reveal").forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 3, 2) * 80}ms`;
    observer.observe(element);
  });
}

const setNavigationOpen = (isOpen) => {
  siteHeader.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute(
    "aria-label",
    isOpen ? "关闭导航菜单" : "打开导航菜单",
  );
};

navToggle.addEventListener("click", () => {
  setNavigationOpen(!siteHeader.classList.contains("nav-open"));
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setNavigationOpen(false));
});

document.addEventListener("click", (event) => {
  if (!siteHeader.contains(event.target)) setNavigationOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !siteHeader.classList.contains("nav-open")) {
    return;
  }

  setNavigationOpen(false);
  navToggle.focus();
});

let scrollTicking = false;

const updateHeader = () => {
  const currentScroll = window.scrollY;
  siteHeader.classList.toggle("is-scrolled", currentScroll > 20);

  if (currentScroll <= 80) setNavigationOpen(false);

  const marker = currentScroll + window.innerHeight * 0.36;
  let currentSection = null;

  navSections.forEach((section) => {
    if (section.offsetTop <= marker) currentSection = section;
  });

  navLinks.forEach((link) => {
    const isActive = link.dataset.navSection === currentSection?.id;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });

  scrollTicking = false;
};

window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateHeader);
  },
  { passive: true },
);

window.addEventListener("resize", updateHeader);
updateHeader();

copyButton.addEventListener("click", async () => {
  const email = copyButton.dataset.copy;

  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = "已复制";
  } catch {
    copyStatus.textContent = email;
  }

  window.setTimeout(() => {
    copyStatus.textContent = "";
  }, 2000);
});
