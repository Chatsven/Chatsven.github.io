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

document.documentElement.dataset.motion = reducedMotion
  ? "reduced"
  : "checking";

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

        const enableGridInteraction = () => {
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
        };

        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : "";
        const connection =
          navigator.connection ??
          navigator.mozConnection ??
          navigator.webkitConnection;
        const cores = navigator.hardwareConcurrency ?? 8;
        const memory = navigator.deviceMemory ?? 8;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const renderedPixels = innerWidth * innerHeight * dpr * dpr;
        const softwareRenderer =
          /swiftshader|llvmpipe|software/i.test(renderer);
        const eligibleForInteraction =
          finePointer &&
          !reducedMotion &&
          !connection?.saveData &&
          cores >= 6 &&
          memory >= 4 &&
          !softwareRenderer &&
          renderedPixels < 7_500_000;

        if (!eligibleForInteraction) {
          document.documentElement.dataset.motion = "reduced";
        } else {
          let frames = 0;
          let startTime = 0;

          const measureFrameRate = (time) => {
            if (!startTime) startTime = time;
            frames += 1;

            if (frames < 36) {
              window.requestAnimationFrame(measureFrameRate);
              return;
            }

            const fps = (frames * 1000) / (time - startTime);
            const canAnimate = fps >= 26;
            document.documentElement.dataset.motion = canAnimate
              ? "full"
              : "reduced";

            if (canAnimate) enableGridInteraction();
          };

          window.requestAnimationFrame(measureFrameRate);
        }
      }
    }
  }
}

const heroStory = document.querySelector("[data-hero-story]");
const heroTitle = document.querySelector(".hero-title");

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
    "--title-tracking",
    `${(-0.022 + progress * 0.03).toFixed(4)}em`,
  );
  hero.style.setProperty(
    "--title-tracking-hover",
    `${(-0.008 + progress * 0.012).toFixed(4)}em`,
  );

  if (phase === 2) heroTitle?.classList.remove("is-hovered");
};

if (hero && heroTitle) {
  const lineElements = [...heroTitle.querySelectorAll(".hero-line")];

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

  heroTitle.addEventListener(
    "pointermove",
    (event) => {
      if (hero.dataset.phase === "2") {
        heroTitle.classList.remove("is-hovered");
        return;
      }

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

  heroTitle.addEventListener("pointerleave", () => {
    heroTitle.classList.remove("is-hovered");
  });
}

const albumSwitcher = document.querySelector("[data-album-switcher]");
const albumStage = document.querySelector("[data-album-stage]");
const albumTrack = document.querySelector("[data-album-track]");
const projectSlides = [
  ...document.querySelectorAll("[data-project-slide]"),
];
const projectMeta = document.querySelector(".project-meta");
const projectCurrent = document.querySelector("[data-project-current]");
const projectTotal = document.querySelector("[data-project-total]");
const projectType = document.querySelector("[data-project-type]");
const projectTitle = document.querySelector("[data-project-title]");
const projectDescription = document.querySelector(
  "[data-project-description]",
);
const projectTags = document.querySelector("[data-project-tags]");
const projectLink = document.querySelector("[data-project-link]");
const projects = [
  {
    type: "USERSCRIPT · JAVASCRIPT",
    title: "Citizen Userscript for Wikimedia",
    description:
      "一个为维基媒体项目打造的 Citizen 界面用户脚本。无需更换皮肤，就能在基于 Vector 2022 的维基页面上使用更清爽的阅读与编辑体验。",
    tags: ["MediaWiki", "Open Source", "UI"],
    href: "https://github.com/Chatsven/citizen-userscript-wikimedia",
  },
  {
    type: "WEB EXPERIENCE · HTML",
    title: "澪空の自介站",
    description:
      "以可变字体、动态网格与自适应动效构成的个人网站。视觉会随着浏览进度改变，也会按照装置性能选择合适的效果。",
    tags: ["HTML", "CSS", "JavaScript"],
    href: "https://mio.cool/",
  },
  {
    type: "OPEN SOURCE · GITHUB",
    title: "更多开源项目",
    description:
      "从维基媒体工具到网页实验，更多仍在维护与持续更新的作品都能在 GitHub 找到。",
    tags: ["Open Source", "Web", "Ongoing"],
    href: "https://github.com/Chatsven?tab=repositories",
  },
  {
    type: "RESERVED · FUTURE WORK",
    title: "预留作品位 04",
    description:
      "这个位置留给下一件正在构思的作品，内容与预览会在完成后补上。",
    tags: ["Reserved", "Coming Soon"],
    href: "",
    placeholder: true,
  },
  {
    type: "RESERVED · FUTURE WORK",
    title: "预留作品位 05",
    description:
      "这是第二个预留展示位，用来保持专辑切换器完整的五格节奏。",
    tags: ["Reserved", "Coming Soon"],
    href: "",
    placeholder: true,
  },
];

if (
  albumSwitcher &&
  albumStage &&
  albumTrack &&
  projectSlides.length === projects.length &&
  projectMeta &&
  projectCurrent &&
  projectTotal &&
  projectType &&
  projectTitle &&
  projectDescription &&
  projectTags &&
  projectLink
) {
  const cloneProjectSlide = (source, projectIndex, position) => {
    const clone = source.cloneNode(true);
    clone.dataset.projectIndex = String(projectIndex);
    clone.dataset.projectClone = position;
    clone.classList.remove("is-active");
    clone.querySelectorAll(".is-active").forEach((element) => {
      element.classList.remove("is-active");
    });
    const cloneCard = clone.querySelector(".album-card");
    cloneCard?.setAttribute("aria-hidden", "true");
    cloneCard?.setAttribute("aria-pressed", "false");
    if (cloneCard) cloneCard.tabIndex = -1;
    return clone;
  };
  const firstProjectSlide = projectSlides[0];
  const lastProjectSlide = projectSlides[projectSlides.length - 1];
  albumTrack.prepend(
    cloneProjectSlide(
      projectSlides[projectSlides.length - 2],
      projects.length - 2,
      "leading-outer",
    ),
    cloneProjectSlide(
      lastProjectSlide,
      projects.length - 1,
      "leading",
    ),
  );
  albumTrack.append(
    cloneProjectSlide(firstProjectSlide, 0, "trailing"),
    cloneProjectSlide(projectSlides[1], 1, "trailing-outer"),
  );
  const carouselSlides = [
    ...albumTrack.querySelectorAll("[data-project-slide]"),
  ];

  let activeProject = -1;
  let currentSlide = null;
  let projectMetaTimer = 0;
  let albumScrollTicking = false;
  let albumSettleTimer = 0;
  let dragState = null;
  let suppressProjectClick = false;

  projectTotal.textContent = String(projects.length).padStart(2, "0");

  const renderProjectMeta = () => {
    const project = projects[activeProject];
    projectCurrent.textContent = String(activeProject + 1).padStart(2, "0");
    projectType.textContent = project.type;
    projectTitle.textContent = project.title;
    projectDescription.textContent = project.description;
    projectTags.replaceChildren(
      ...project.tags.map((tag) => {
        const element = document.createElement("span");
        element.textContent = tag;
        return element;
      }),
    );
    projectLink.href = project.href;
    projectLink.hidden = Boolean(project.placeholder);
    projectLink.setAttribute("aria-label", `查看作品：${project.title}`);
  };

  const getClosestSlide = () => {
    const stageCenter =
      albumStage.scrollLeft + albumStage.clientWidth / 2;
    let closestSlide = carouselSlides[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    carouselSlides.forEach((slide) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - stageCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSlide = slide;
      }
    });

    return closestSlide;
  };

  const setActiveProject = (slide, animate = true) => {
    if (!slide) return;
    const index = Number(slide.dataset.projectIndex);
    const projectChanged = index !== activeProject;
    activeProject = index;
    currentSlide = slide;

    carouselSlides.forEach((carouselSlide) => {
      const isActive = carouselSlide === slide;
      const card = carouselSlide.querySelector(".album-card");
      carouselSlide.classList.toggle("is-active", isActive);
      card?.classList.toggle("is-active", isActive);
      card?.setAttribute("aria-pressed", String(isActive));
    });

    if (!projectChanged) return;
    projectCurrent.textContent = String(activeProject + 1).padStart(
      2,
      "0",
    );
    window.clearTimeout(projectMetaTimer);

    if (!animate || reducedMotion) {
      projectMeta.classList.remove("is-refreshing");
      renderProjectMeta();
      return;
    }

    projectMeta.classList.add("is-refreshing");
    projectMetaTimer = window.setTimeout(() => {
      renderProjectMeta();
      projectMeta.classList.remove("is-refreshing");
    }, 120);
  };

  const scrollToSlide = (
    slide,
    behavior = reducedMotion ? "auto" : "smooth",
  ) => {
    if (!slide) return;
    const targetLeft =
      slide.offsetLeft -
      (albumStage.clientWidth - slide.offsetWidth) / 2;

    albumStage.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  };

  const scrollToProject = (index) => {
    scrollToSlide(projectSlides[index]);
  };

  const stepProject = (direction) => {
    const currentIndex = Math.max(
      0,
      carouselSlides.indexOf(getClosestSlide()),
    );
    scrollToSlide(
      carouselSlides[
        Math.max(
          0,
          Math.min(carouselSlides.length - 1, currentIndex + direction),
        )
      ],
    );
  };

  const settleProject = () => {
    const closestSlide = getClosestSlide();
    if (!closestSlide.dataset.projectClone) {
      setActiveProject(closestSlide);
      return;
    }

    const targetSlide =
      projectSlides[Number(closestSlide.dataset.projectIndex)];
    scrollToSlide(targetSlide, "auto");
    setActiveProject(targetSlide, false);
  };

  const updateAlbumState = () => {
    setActiveProject(getClosestSlide());
    window.clearTimeout(albumSettleTimer);
    if (!albumSwitcher.classList.contains("is-dragging")) {
      albumSettleTimer = window.setTimeout(settleProject, 160);
    }
    albumScrollTicking = false;
  };

  const syncAlbumGeometry = () => {
    const slideWidth =
      carouselSlides[0]?.getBoundingClientRect().width ?? 0;
    const gutter = Math.max(
      0,
      (albumStage.clientWidth - slideWidth) / 2,
    );
    albumTrack.style.setProperty(
      "--album-gutter",
      `${gutter.toFixed(2)}px`,
    );
  };

  projectSlides.forEach((slide, index) => {
    slide.querySelector(".album-card")?.addEventListener("click", () => {
      scrollToProject(index);
    });
  });

  albumSwitcher.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepProject(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepProject(1);
    }
  });

  albumStage.addEventListener(
    "scroll",
    () => {
      if (albumScrollTicking) return;
      albumScrollTicking = true;
      window.requestAnimationFrame(updateAlbumState);
    },
    { passive: true },
  );

  const finishProjectDrag = () => {
    if (!dragState) return;

    if (albumStage.hasPointerCapture(dragState.pointerId)) {
      albumStage.releasePointerCapture(dragState.pointerId);
    }

    const wasDragged = dragState.dragged;
    dragState = null;
    albumSwitcher.classList.remove("is-dragging");

    if (!wasDragged) return;
    suppressProjectClick = true;
    settleProject();
    window.setTimeout(() => {
      suppressProjectClick = false;
    }, 0);
  };

  albumStage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: albumStage.scrollLeft,
      dragged: false,
    };
    albumStage.setPointerCapture(event.pointerId);
  });

  albumStage.addEventListener(
    "pointermove",
    (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      dragState.dragged = true;
      albumSwitcher.classList.add("is-dragging");
      albumStage.scrollLeft = dragState.startScrollLeft - deltaX;
      event.preventDefault();
    },
    { passive: false },
  );

  albumStage.addEventListener("pointerup", finishProjectDrag);
  albumStage.addEventListener("pointercancel", finishProjectDrag);
  albumStage.addEventListener(
    "click",
    (event) => {
      if (!suppressProjectClick) return;
      suppressProjectClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true },
  );

  syncAlbumGeometry();
  scrollToSlide(projectSlides[0], "auto");
  setActiveProject(projectSlides[0], false);

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      syncAlbumGeometry();
      if (activeProject >= 0) {
        scrollToSlide(currentSlide, "auto");
      }
    }).observe(albumStage);
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
  updateHeroStory();
  const heroStoryEnd = heroStory
    ? heroStory.offsetTop + heroStory.offsetHeight
    : 0;
  siteHeader.classList.toggle("is-scrolled", currentScroll >= heroStoryEnd);

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
