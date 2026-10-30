const siteHeader = document.querySelector("[data-site-header]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");
const navLinks = [...document.querySelectorAll("[data-nav-section]")];
const navSections = navLinks
  .map((link) => document.querySelector(`#${link.dataset.navSection}`))
  .filter(Boolean);

const isEditableTarget = (target) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true']",
    ),
  );

document.addEventListener("selectstart", (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  const isSelectAll =
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "a";

  if (isSelectAll && !isEditableTarget(event.target)) {
    event.preventDefault();
  }
});

document.addEventListener("copy", (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const anchorLinks = [...document.querySelectorAll('a[href^="#"]')];
const anchorOffset = 88;
let anchorAnimationFrame = 0;

const resolveAnchorElement = (target) =>
  target.querySelector(".section-heading") ?? target;

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

  if (anchor.matches(".footer")) {
    dampedScrollToY(getLayoutTop(anchor));
    return;
  }

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
  const gl = gridCanvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

  if (gl) {
    const vertexSource = `
      attribute vec2 a_position;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;

      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform vec2 u_previousPointer;
      uniform float u_time;
      uniform float u_strength;
      uniform float u_motion;
      uniform float u_dpr;

      float gridLine(
        float coordinate,
        float spacing,
        float width,
        float feather
      ) {
        float distanceToLine =
          abs(fract(coordinate / spacing + 0.5) - 0.5) * spacing;
        return 1.0 - smoothstep(
          width,
          width + feather,
          distanceToLine
        );
      }

      float segmentDistance(vec2 point, vec2 start, vec2 end) {
        vec2 offset = point - start;
        vec2 direction = end - start;
        float progress = clamp(
          dot(offset, direction) /
            max(dot(direction, direction), 0.0001),
          0.0,
          1.0
        );
        return length(offset - direction * progress);
      }

      void main() {
        vec2 pixel = vec2(
          gl_FragCoord.x / u_dpr,
          u_resolution.y - gl_FragCoord.y / u_dpr
        );
        vec2 pointer = u_pointer;
        vec2 previousPointer = u_previousPointer;
        vec2 delta = pixel - pointer;
        float distanceToPointer = length(delta);
        vec2 direction = distanceToPointer > 0.001
          ? delta / distanceToPointer
          : vec2(1.0, 0.0);
        vec2 tangent = vec2(-direction.y, direction.x);

        float pointerField = exp(
          -distanceToPointer * distanceToPointer / 105625.0
        );
        float trailDistance = segmentDistance(
          pixel,
          previousPointer,
          pointer
        );
        float trail = exp(
          -trailDistance * trailDistance / 7225.0
        );
        float motion = clamp(u_motion, 0.0, 1.0);
        float field = max(pointerField, trail * motion * 0.82);
        field *= u_strength;

        float primaryWave = sin(
          distanceToPointer * 0.047 - u_time * 3.1
        );
        float secondaryWave = sin(
          distanceToPointer * 0.093 + u_time * 1.9
        ) * 0.34;
        vec2 travel = normalize(
          pointer - previousPointer + vec2(0.0001, 0.0)
        );
        vec2 travelNormal = vec2(-travel.y, travel.x);
        float wake = sin(trailDistance * 0.082 - u_time * 6.2);
        float amplitude = field * (15.0 + motion * 10.0);

        vec2 offset =
          direction * (primaryWave + secondaryWave) * amplitude;
        offset += travelNormal * wake * trail * motion * 18.0;

        vec2 warped = pixel + offset;
        float feather = 0.72 + field * 1.8;
        float minor = max(
          gridLine(warped.x, 48.0, 0.32, feather),
          gridLine(warped.y, 48.0, 0.32, feather)
        );
        float major = max(
          gridLine(warped.x, 192.0, 0.55, feather),
          gridLine(warped.y, 192.0, 0.55, feather)
        );
        float alpha = max(minor * 0.095, major * 0.17);
        vec3 color = vec3(10.0 / 255.0, 83.0 / 255.0, 104.0 / 255.0);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSource,
    );

    if (vertexShader && fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const positionLocation = gl.getAttribLocation(
          program,
          "a_position",
        );
        const uniforms = {
          resolution: gl.getUniformLocation(program, "u_resolution"),
          pointer: gl.getUniformLocation(program, "u_pointer"),
          previousPointer: gl.getUniformLocation(
            program,
            "u_previousPointer",
          ),
          time: gl.getUniformLocation(program, "u_time"),
          strength: gl.getUniformLocation(program, "u_strength"),
          motion: gl.getUniformLocation(program, "u_motion"),
          dpr: gl.getUniformLocation(program, "u_dpr"),
        };
        const buffer = gl.createBuffer();
        const state = {
          width: 1,
          height: 1,
          frame: 0,
          active: false,
          strength: 0,
          targetStrength: 0,
          motion: 0,
          targetX: 0,
          targetY: 0,
          x: 0,
          y: 0,
          trailX: 0,
          trailY: 0,
          targetSet: false,
          lastFrameTime: performance.now(),
          lastActivityTime: 0,
        };

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW,
        );
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(
          positionLocation,
          2,
          gl.FLOAT,
          false,
          0,
          0,
        );
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);

        const render = (time) => {
          const elapsed = Math.min(
            Math.max((time - state.lastFrameTime) / 1000, 0),
            0.05,
          );
          state.lastFrameTime = time;
          const positionEase = 1 - Math.exp(-elapsed * 16);
          const trailEase = 1 - Math.exp(-elapsed * 4);
          const strengthEase = 1 - Math.exp(-elapsed * 22);
          const nextX = state.x + (state.targetX - state.x) * positionEase;
          const nextY = state.y + (state.targetY - state.y) * positionEase;
          const velocity =
            elapsed > 0
              ? Math.hypot(nextX - state.x, nextY - state.y) /
                elapsed /
                1100
              : 0;

          state.trailX += (nextX - state.trailX) * trailEase;
          state.trailY += (nextY - state.trailY) * trailEase;
          state.x = nextX;
          state.y = nextY;
          const idleProgress = Math.min(
            Math.max((time - state.lastActivityTime) / 1000, 0),
            1,
          );
          const fadeProgress = Math.min(
            Math.max((idleProgress - 0.22) / 0.78, 0),
            1,
          );
          state.targetStrength =
            1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
          state.motion +=
            (Math.min(velocity, 1) - state.motion) * strengthEase;
          state.strength +=
            (state.targetStrength - state.strength) * strengthEase;

          gl.uniform2f(uniforms.resolution, state.width, state.height);
          gl.uniform2f(uniforms.pointer, state.x, state.y);
          gl.uniform2f(
            uniforms.previousPointer,
            state.trailX,
            state.trailY,
          );
          gl.uniform1f(uniforms.time, time / 1000);
          gl.uniform1f(uniforms.strength, state.strength);
          gl.uniform1f(uniforms.motion, state.motion);
          gl.uniform1f(
            uniforms.dpr,
            gridCanvas.width / state.width,
          );
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          const stillAnimating =
            state.targetStrength > 0.01 || state.strength > 0.01;
          if (stillAnimating) {
            state.frame = window.requestAnimationFrame(render);
          } else {
            state.strength = 0;
            state.frame = 0;
            hero.classList.remove("grid-is-active");
          }
        };

        const startRendering = () => {
          if (state.frame) return;
          state.lastFrameTime = performance.now();
          state.frame = window.requestAnimationFrame(render);
        };

        const resizeGrid = () => {
          const bounds = hero.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          state.width = Math.max(1, Math.round(bounds.width));
          state.height = Math.max(1, Math.round(bounds.height));
          gridCanvas.width = Math.round(state.width * dpr);
          gridCanvas.height = Math.round(state.height * dpr);
          gl.viewport(0, 0, gridCanvas.width, gridCanvas.height);
          render(performance.now());
        };

        resizeGrid();
        new ResizeObserver(resizeGrid).observe(hero);

        if (finePointer && !reducedMotion) {
          hero.addEventListener("pointerenter", (event) => {
            const bounds = hero.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;

            state.targetX = x;
            state.targetY = y;
            if (!state.targetSet) {
              state.x = x;
              state.y = y;
              state.trailX = x;
              state.trailY = y;
              state.targetSet = true;
            }
            state.lastActivityTime = performance.now();
            hero.classList.add("grid-is-active");
            startRendering();
          });

          hero.addEventListener(
            "pointermove",
            (event) => {
              const bounds = hero.getBoundingClientRect();
              state.targetX = event.clientX - bounds.left;
              state.targetY = event.clientY - bounds.top;
              state.lastActivityTime = performance.now();
              startRendering();
            },
            { passive: true },
          );

          hero.addEventListener("pointerleave", () => {
            state.lastActivityTime = performance.now();
            state.targetSet = false;
            startRendering();
          });
        }
      }
    }
  }
}

const heroStory = document.querySelector("[data-hero-story]");
const heroTitle = document.querySelector(".hero-title");
const heroTitleTrigger = document.querySelector("[data-variable-title]");
const heroTitleNodes = document.querySelector(".hero-title-nodes");
const heroProgressLabel = document.querySelector(".hero-progress-label");
const phaseLabels = ["01 · TYPOGRAPHY", "03 · IDENTITY"];

const updateHeroStory = () => {
  if (!hero || !heroStory) return;

  const storyTop = heroStory.offsetTop;
  const scrollRange = Math.max(
    1,
    heroStory.offsetHeight - window.innerHeight,
  );
  const progress = Math.min(
    1,
    Math.max(0, (window.scrollY - storyTop) / scrollRange),
  );
  const phase = progress < 0.5 ? 0 : 2;

  hero.dataset.phase = String(phase);
  hero.style.setProperty("--hero-progress", progress.toFixed(4));
  hero.style.setProperty("--title-opsz", (118 + progress * 26).toFixed(1));
  hero.style.setProperty("--title-weight", (480 + progress * 340).toFixed(1));
  hero.style.setProperty("--title-soft", (30 + progress * 58).toFixed(1));
  hero.style.setProperty("--title-wonk", progress > 0.7 ? "1" : "0");
  hero.style.setProperty(
    "--italic-weight",
    (435 + progress * 320).toFixed(1),
  );
  hero.style.setProperty(
    "--italic-soft",
    (30 + progress * 58).toFixed(1),
  );
  hero.style.setProperty("--italic-wonk", "1");
  hero.style.setProperty(
    "--title-tracking",
    `${(-0.04 + progress * 0.03).toFixed(4)}em`,
  );
  hero.style.setProperty(
    "--title-tracking-hover",
    `${(-0.018 + progress * 0.008).toFixed(4)}em`,
  );

  if (heroProgressLabel) {
    heroProgressLabel.textContent = phaseLabels[phase === 2 ? 1 : 0];
  }
};

if (hero && heroTitle && heroTitleTrigger && heroTitleNodes) {
  const lineElements = [...heroTitle.querySelectorAll(".hero-line")];
  let nodePoints = [];
  let dragState = null;
  let pendingExit = false;

  const wrapCharacters = (parent) => {
    [...parent.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();

        [...child.textContent].forEach((character) => {
          if (/\s/.test(character)) {
            fragment.append(character);
            return;
          }

          const span = document.createElement("span");
          span.className = "hero-char";
          span.textContent = character;
          fragment.append(span);
        });

        child.replaceWith(fragment);
        return;
      }

      if (child instanceof Element) wrapCharacters(child);
    });
  };

  lineElements.forEach(wrapCharacters);
  const characterElements = [...heroTitle.querySelectorAll(".hero-char")];
  const characterOffsets = characterElements.map(() => ({ x: 0, y: 0 }));

  heroTitle.addEventListener(
    "pointermove",
    (event) => {
      if (heroTitle.classList.contains("is-editing")) return;

      const characterHit = characterElements.some((character) => {
        const bounds = character.getBoundingClientRect();
        return (
          event.clientX >= bounds.left - 2 &&
          event.clientX <= bounds.right + 2 &&
          event.clientY >= bounds.top - 2 &&
          event.clientY <= bounds.bottom + 2
        );
      });
      const lineHit =
        heroTitle.classList.contains("is-hovered") &&
        lineElements.some((line) => {
          const bounds = line.getBoundingClientRect();
          return (
            event.clientX >= bounds.left - 8 &&
            event.clientX <= bounds.right + 8 &&
            event.clientY >= bounds.top - 8 &&
            event.clientY <= bounds.bottom + 8
          );
        });

      heroTitle.classList.toggle("is-hovered", characterHit || lineHit);
    },
    { passive: true },
  );

  const drawTitleNodes = () => {
    const canvasBounds = heroTitleNodes.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvasBounds.width));
    const height = Math.max(1, Math.round(canvasBounds.height));

    if (
      heroTitleNodes.width !== Math.round(width * ratio) ||
      heroTitleNodes.height !== Math.round(height * ratio)
    ) {
      heroTitleNodes.width = Math.round(width * ratio);
      heroTitleNodes.height = Math.round(height * ratio);
    }

    const context = heroTitleNodes.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    nodePoints = [];

    const lineRects = [...heroTitle.querySelectorAll(".hero-line")].map(
      (line) => {
        const bounds = line.getBoundingClientRect();
        return {
          left: bounds.left - canvasBounds.left,
          top: bounds.top - canvasBounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      },
    );

    context.lineWidth = 0.9;
    context.strokeStyle = "rgba(89, 213, 234, 0.4)";
    lineRects.forEach((bounds) => {
      context.strokeRect(
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
      );
    });

    let characterIndex = 0;
    lineElements.forEach((line) => {
      const characters = [...line.querySelectorAll(".hero-char")];
      const centers = characters.map((character) => {
        const bounds = character.getBoundingClientRect();
        return {
          x:
            bounds.left -
            canvasBounds.left +
            bounds.width / 2,
          y:
            bounds.top -
            canvasBounds.top +
            bounds.height / 2,
        };
      });

      if (centers.length > 1) {
        context.beginPath();
        centers.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }

      centers.forEach((point) => {
        nodePoints.push({ ...point, characterIndex });
        context.beginPath();
        context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        context.fillStyle = "#59d5ea";
        context.fill();
        context.strokeStyle = "rgba(6, 31, 44, 0.82)";
        context.lineWidth = 1.1;
        context.stroke();
        characterIndex += 1;
      });
    });
  };

  const clearTitleNodes = () => {
    nodePoints = [];
    heroTitleNodes
      .getContext("2d")
      .clearRect(0, 0, heroTitleNodes.width, heroTitleNodes.height);
  };

  const resetCharacterOffsets = () => {
    characterOffsets.forEach((offset, index) => {
      offset.x = 0;
      offset.y = 0;
      characterElements[index].style.transform = "";
    });
  };

  const exitTitleVector = () => {
    heroTitle.classList.remove("is-editing");
    heroTitle.classList.add("is-bold");
    heroTitleTrigger.setAttribute("aria-pressed", "false");
    resetCharacterOffsets();
    clearTitleNodes();
  };

  const enterTitleVector = () => {
    heroTitle.classList.remove("is-bold");
    heroTitle.classList.add("is-editing");
    heroTitleTrigger.setAttribute("aria-pressed", "true");
    window.requestAnimationFrame(drawTitleNodes);
  };

  heroTitle.addEventListener("click", (event) => {
    if (heroTitle.classList.contains("is-editing")) {
      if (pendingExit) {
        pendingExit = false;
        exitTitleVector();
      }
      return;
    }

    if (event.target.closest?.(".hero-char")) enterTitleVector();
  });

  heroTitleTrigger.addEventListener("keydown", (event) => {
    if (
      !heroTitle.classList.contains("is-editing") &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      enterTitleVector();
    }
  });

  const getCanvasPoint = (event) => {
    const bounds = heroTitleNodes.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const findNode = (point) =>
    nodePoints.find(
      (node) => Math.hypot(node.x - point.x, node.y - point.y) < 11,
    ) ?? null;

  heroTitle.addEventListener("pointerdown", (event) => {
    const point = getCanvasPoint(event);
    const node = findNode(point);

    if (!node) {
      pendingExit = true;
      return;
    }

    pendingExit = false;
    dragState = {
      ...node,
      pointerX: point.x,
      pointerY: point.y,
    };
    heroTitle.setPointerCapture(event.pointerId);
    heroTitle.style.cursor = "grabbing";
    event.preventDefault();
  });

  heroTitle.addEventListener(
    "pointermove",
    (event) => {
      const point = getCanvasPoint(event);

      if (!dragState) {
        heroTitle.style.cursor = findNode(point) ? "grab" : "crosshair";
        return;
      }

      const deltaX = point.x - dragState.pointerX;
      const deltaY = point.y - dragState.pointerY;
      const offset = characterOffsets[dragState.characterIndex];
      offset.x += deltaX;
      offset.y += deltaY;
      characterElements[dragState.characterIndex].style.transform =
        `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`;
      dragState.pointerX = point.x;
      dragState.pointerY = point.y;
      drawTitleNodes();
    },
    { passive: true },
  );

  const finishDragging = () => {
    dragState = null;
    heroTitle.style.cursor = "crosshair";
  };

  heroTitle.addEventListener("pointerup", finishDragging);
  heroTitle.addEventListener("pointercancel", finishDragging);
  heroTitle.addEventListener("pointerleave", () => {
    heroTitle.classList.remove("is-hovered");
    if (!heroTitle.classList.contains("is-editing")) {
      heroTitle.classList.remove("is-bold");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      heroTitle.classList.contains("is-editing")
    ) {
      exitTitleVector();
      heroTitleTrigger.focus();
    }
  });

  document.fonts.ready.then(() => {
    if (heroTitle.classList.contains("is-editing")) drawTitleNodes();
  });

  window.addEventListener(
    "resize",
    () => {
      if (heroTitle.classList.contains("is-editing")) drawTitleNodes();
    },
    { passive: true },
  );

  window.addEventListener(
    "scroll",
    () => {
      if (heroTitle.classList.contains("is-editing")) {
        window.requestAnimationFrame(drawTitleNodes);
      }
    },
    { passive: true },
  );
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
  updateHeroStory();

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
