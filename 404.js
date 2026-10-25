const canvas = document.querySelector("#not-found-canvas");
const context = canvas.getContext("2d");
const logicalWidth = 707;
const logicalHeight = 409;
const initialAnchors = [
  [213.8844, 306.8658],
  [213.8844, 263.3305],
  [244.8376, 263.3305],
  [244.8376, 239.9558],
  [213.8844, 239.9558],
  [213.8844, 102.3375],
  [186.4353, 102.3375],
  [100, 253.1041],
  [100, 263.3305],
  [188.7714, 263.3305],
  [188.7714, 306.8658],
  [188.7714, 140.9057],
  [188.7714, 239.9558],
  [133.2893, 239.9558],
  [408.3981, 281.1537],
  [428.2549, 204.6016],
  [408.3981, 128.3418],
  [353.5, 100],
  [298.3099, 128.3418],
  [278.7451, 204.6016],
  [298.3099, 281.1537],
  [353.5, 309.2033],
  [304.4421, 204.6016],
  [353.5, 123.3747],
  [375.9849, 130.0949],
  [315.2465, 260.1165],
  [353.5, 285.8286],
  [331.0151, 279.1084],
  [391.7535, 149.0868],
  [402.5579, 204.6016],
  [576.0468, 306.8658],
  [576.0468, 263.3305],
  [607, 263.3305],
  [607, 239.9558],
  [576.0468, 239.9558],
  [576.0468, 102.3375],
  [548.5977, 102.3375],
  [462.1624, 253.1041],
  [462.1624, 263.3305],
  [550.9338, 263.3305],
  [550.9338, 306.8658],
  [550.9338, 140.9057],
  [550.9338, 239.9558],
  [495.4517, 239.9558],
];

let anchors = initialAnchors.map(([x, y]) => ({ x, y }));
const paths = [];

const addPath = (indices, handles = []) => {
  const edges = indices.map((startIndex, edgeIndex) => {
    const endIndex = indices[(edgeIndex + 1) % indices.length];
    const [h1x = 0, h1y = 0, h2x = 0, h2y = 0] =
      handles[edgeIndex] ?? [];
    return {
      startIndex,
      endIndex,
      h1: { x: h1x, y: h1y },
      h2: { x: h2x, y: h2y },
    };
  });

  paths.push(edges);
};

addPath([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
addPath([11, 12, 13]);
addPath([14, 15, 16, 17, 18, 19, 20, 21], [
  [13.1405, -18.9919, 0, 32.1402],
  [0, -32.1402, 13.1405, 18.6997],
  [-13.1405, -18.9919, 23.6529, 0],
  [-23.6529, 0, 13.1405, -18.9919],
  [-13.1405, 18.6997, 0, -32.1402],
  [0, 32.1402, -13.1405, -18.9919],
  [13.1405, 18.6997, -23.6529, 0],
  [23.6529, 0, -13.1405, 18.6997],
]);
addPath([22, 23, 24, 25], [
  [0, -50.2555, -31.2452, 0],
  [8.4683, 0, -6.7163, -4.3827],
  [0, 0, 0, 0],
  [-7.3003, -14.317, 0, 22.4981],
]);
addPath([26, 27, 28, 29], [
  [-8.4683, 0, 6.7163, 4.3828],
  [0, 0, 0, 0],
  [7.3003, 14.0248, 0, -23.0825],
  [0, 50.2555, 31.2452, 0],
]);
addPath([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
addPath([41, 42, 43]);

let selectedIndex = null;
let hoveredIndex = null;
let activeHandle = null;
let isPointerDown = false;

const toCanvasPoint = (event) => {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * logicalWidth,
    y: ((event.clientY - bounds.top) / bounds.height) * logicalHeight,
  };
};

const getControls = (edge) => {
  const start = anchors[edge.startIndex];
  const end = anchors[edge.endIndex];
  return {
    c1: { x: start.x + edge.h1.x, y: start.y + edge.h1.y },
    c2: { x: end.x + edge.h2.x, y: end.y + edge.h2.y },
  };
};

const getVisibleHandles = () => {
  if (selectedIndex === null) return [];

  return paths
    .flat()
    .filter(
      (edge) =>
        edge.startIndex === selectedIndex ||
        edge.endIndex === selectedIndex,
    )
    .flatMap((edge) => {
      const { c1, c2 } = getControls(edge);
      return [
        {
          edge,
          side: "startIndex",
          point: c1,
        },
        {
          edge,
          side: "endIndex",
          point: c2,
        },
      ];
    });
};

const draw = () => {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const requiredWidth = Math.round(logicalWidth * ratio);
  const requiredHeight = Math.round(logicalHeight * ratio);

  if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
    canvas.width = requiredWidth;
    canvas.height = requiredHeight;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, logicalWidth, logicalHeight);

  context.beginPath();
  paths.forEach((path) => {
    const firstEdge = path[0];
    const firstPoint = anchors[firstEdge.startIndex];
    context.moveTo(firstPoint.x, firstPoint.y);

    path.forEach((edge) => {
      const { c1, c2 } = getControls(edge);
      const end = anchors[edge.endIndex];
      context.bezierCurveTo(
        c1.x,
        c1.y,
        c2.x,
        c2.y,
        end.x,
        end.y,
      );
    });

    context.closePath();
  });
  context.fillStyle = "#000000";
  context.fill("evenodd");

  const visibleHandles = getVisibleHandles();
  visibleHandles.forEach((handle) => {
    const anchor =
      handle.side === "startIndex"
        ? anchors[handle.edge.startIndex]
        : anchors[handle.edge.endIndex];
    context.beginPath();
    context.moveTo(anchor.x, anchor.y);
    context.lineTo(handle.point.x, handle.point.y);
    context.strokeStyle = "rgba(88, 213, 234, 0.42)";
    context.lineWidth = 0.8;
    context.stroke();
  });

  anchors.forEach((point, index) => {
    const isActive = index === selectedIndex;
    const isHovered = index === hoveredIndex;
    const radius = isActive ? 5.4 : isHovered ? 4.7 : 3.25;

    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = isActive ? "#001e31" : "#59d5ea";
    context.fill();
    context.strokeStyle = isActive ? "#59d5ea" : "#165164";
    context.lineWidth = isActive ? 2.4 : 1;
    context.stroke();
  });

  visibleHandles.forEach((handle) => {
    context.beginPath();
    context.arc(handle.point.x, handle.point.y, 3.6, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = "#001e31";
    context.lineWidth = 1.2;
    context.stroke();
  });
};

const findNearestAnchor = (point) => {
  let nearest = null;
  let nearestDistance = 10;

  anchors.forEach((anchor, index) => {
    const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });

  return nearest;
};

const findNearestHandle = (point) => {
  let nearest = null;
  let nearestDistance = 9;

  getVisibleHandles().forEach((handle) => {
    const distance = Math.hypot(
      handle.point.x - point.x,
      handle.point.y - point.y,
    );
    if (distance < nearestDistance) {
      nearest = handle;
      nearestDistance = distance;
    }
  });

  return nearest;
};

canvas.addEventListener("pointermove", (event) => {
  const point = toCanvasPoint(event);

  if (isPointerDown && selectedIndex !== null) {
    if (activeHandle) {
      const anchor = anchors[activeHandle.edge[activeHandle.side]];
      const dx = point.x - anchor.x;
      const dy = point.y - anchor.y;
      const previousHandles =
        activeHandle.side === "startIndex"
          ? activeHandle.edge.h1
          : activeHandle.edge.h2;

      if (
        Math.abs(previousHandles.x) +
          Math.abs(previousHandles.y) +
          Math.abs(dx) +
          Math.abs(dy) >
        0.1
      ) {
        if (activeHandle.side === "startIndex") {
          activeHandle.edge.h1 = { x: dx, y: dy };
        } else {
          activeHandle.edge.h2 = { x: dx, y: dy };
        }
      }
    } else {
      anchors[selectedIndex] = point;
    }

    draw();
    return;
  }

  hoveredIndex = findNearestAnchor(point);
  canvas.style.cursor = hoveredIndex === null ? "crosshair" : "grab";
  draw();
});

canvas.addEventListener("pointerdown", (event) => {
  const point = toCanvasPoint(event);
  const handle = findNearestHandle(point);
  const anchorIndex = findNearestAnchor(point);

  if (handle) activeHandle = handle;
  if (anchorIndex !== null) selectedIndex = anchorIndex;
  if (!handle && anchorIndex === null) selectedIndex = null;

  isPointerDown = Boolean(handle || anchorIndex !== null);
  if (isPointerDown) {
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    draw();
  }
});

const stopPointerInteraction = () => {
  isPointerDown = false;
  activeHandle = null;
  canvas.style.cursor = hoveredIndex === null ? "crosshair" : "grab";
  draw();
};

canvas.addEventListener("pointerup", stopPointerInteraction);
canvas.addEventListener("pointercancel", stopPointerInteraction);
canvas.addEventListener("pointerleave", () => {
  if (!isPointerDown) {
    hoveredIndex = null;
    canvas.style.cursor = "crosshair";
    draw();
  }
});
canvas.addEventListener("dblclick", () => {
  anchors = initialAnchors.map(([x, y]) => ({ x, y }));
  selectedIndex = null;
  hoveredIndex = null;
  activeHandle = null;
  draw();
});

window.addEventListener("resize", draw);
draw();
