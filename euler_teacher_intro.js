// Reveal deck setup
function initializeDeck() {
    if (!window.Reveal) return;

    const plugins = [];
    if (window.RevealMarkdown) plugins.push(RevealMarkdown);
    if (window.RevealNotes) plugins.push(RevealNotes);

    Reveal.initialize({
        controls: true,
        progress: true,
        hash: true,
        slideNumber: "c/t",
        defaultTiming: 120,
        center: false,
        transition: "slide",
        backgroundTransition: "fade",
        width: 1280,
        height: 720,
        margin: 0.04,
        plugins,
        markdown: {
            smartypants: true
        }
    }).then(() => {
        initializeSketchTool();
        initializeStockAnimation();
        resizeSketchCanvas();
    });

    Reveal.on("slidechanged", () => requestAnimationFrame(resizeSketchCanvas));
}

function initializeStockAnimation() {
    renderStockFormulaRows();

    document.querySelectorAll(".stock-source-table tbody").forEach(tableBody => {
        new MutationObserver(() => renderStockFormulaRows({ restartAnimation: true })).observe(tableBody, {
            characterData: true,
            childList: true,
            subtree: true
        });
    });

    const syncStockAnimation = () => {
        const panelsToAnimate = [];

        document.querySelectorAll(".stock-replay-panel").forEach(panel => {
            const trigger = panel.querySelector(".stock-animation-trigger");

            panel.classList.remove("is-animated");
            if (trigger?.classList.contains("visible")) panelsToAnimate.push(panel);
        });

        renderStockFormulaRows();

        panelsToAnimate.forEach(panel => {
            void panel.offsetWidth;
            requestAnimationFrame(() => panel.classList.add("is-animated"));
        });
    };

    Reveal.on("fragmentshown", syncStockAnimation);
    Reveal.on("fragmenthidden", syncStockAnimation);
    Reveal.on("slidechanged", syncStockAnimation);
    syncStockAnimation();
}

function renderStockFormulaRows({ restartAnimation = false } = {}) {
    const panelsToRestart = [];

    document.querySelectorAll(".stock-replay-panel").forEach(panel => {
        const sourceTable = panel.querySelector(".stock-source-table");
        const transformTable = panel.querySelector(".stock-transform-table");
        const trigger = panel.querySelector(".stock-animation-trigger");
        if (!sourceTable || !transformTable) return;

        if (restartAnimation && panel.classList.contains("is-animated") && trigger?.classList.contains("visible")) {
            panelsToRestart.push(panel);
            panel.classList.remove("is-animated");
        }

        transformTable.textContent = "";
        const rows = Array.from(sourceTable.querySelectorAll("tbody tr")).map(sourceRow => {
            const [posts, segments, regions] = Array.from(sourceRow.cells)
                .slice(0, 3)
                .map(cell => Number.parseInt(cell.textContent.trim(), 10));
            const isValid = segments === posts + regions - 1;

            sourceRow.classList.toggle("stock-source-invalid", !isValid);
            return { posts, segments, regions, isValid };
        });

        const stage = document.createElement("div");
        stage.className = "stock-column-stage";
        stage.style.setProperty("--stock-row-count", rows.length);
        stage.appendChild(createStockColumn("posts", "Posts", rows.map(row => row.posts), rows));
        stage.appendChild(createStockColumn("segments", "Segments", rows.map(row => row.segments), rows));
        stage.appendChild(createStockColumn("regions", "Regions", rows.map(row => row.regions), rows));
        stage.appendChild(createStockOperatorColumn("equals", "=", rows.length));
        stage.appendChild(createStockOperatorColumn("plus", "+", rows.length));
        stage.appendChild(createStockOperatorColumn("minus", "-1", rows.length));
        transformTable.appendChild(stage);
    });

    panelsToRestart.forEach(panel => {
        void panel.offsetWidth;
        requestAnimationFrame(() => panel.classList.add("is-animated"));
    });
}

function formatStockValue(value) {
    return Number.isFinite(value) ? value : "?";
}

function createStockColumn(kind, label, values, rows) {
    const column = document.createElement("div");
    column.className = `stock-moving-column stock-column-${kind}`;
    column.appendChild(createStockColumnCell(label, `stock-column-heading stock-column-${kind}-heading`, false));

    values.forEach((value, index) => {
        column.appendChild(createStockColumnCell(
            formatStockValue(value),
            `stock-column-value${rows[index].isValid ? "" : " stock-example-invalid"}`,
            true
        ));
    });

    return column;
}

function createStockOperatorColumn(kind, value, rowCount) {
    const column = document.createElement("div");
    column.className = `stock-op-column stock-op-${kind}`;
    column.appendChild(createStockColumnCell("", "stock-column-heading stock-op-heading", false));

    for (let index = 0; index < rowCount; index++) {
        column.appendChild(createStockColumnCell(value, "stock-op-value", true));
    }

    return column;
}

function createStockColumnCell(value, className, isValueCell) {
    const cell = document.createElement("span");
    cell.className = className;
    cell.textContent = value;
    cell.dataset.cellType = isValueCell ? "value" : "heading";
    return cell;
}

// Quiz logic
const quizSolutions = { 1: true, 2: false, 3: true };

function checkAnswer(id, userChoiceIsConnected, clickedButton) {
    const isCorrect = userChoiceIsConnected === quizSolutions[id];
    const card = document.getElementById(`q${id}`);
    const feedback = card.querySelector(".q-feedback");
    const buttons = card.querySelectorAll("button");
    const answerText = userChoiceIsConnected ? "Connected" : "Disconnected";

    if (isCorrect) {
        feedback.textContent = `Correct: ${answerText}`;
        feedback.className = "q-feedback mt-2 text-center text-sm font-bold text-green-600 block";
        card.classList.add("border-green-300", "bg-green-50");
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add("cursor-not-allowed");
            if (btn === clickedButton) {
                btn.classList.add("answer-selected");
            } else {
                btn.classList.add("answer-unselected");
            }
        });
    } else {
        feedback.textContent = "Not quite. Look closer at the segments.";
        feedback.className = "q-feedback mt-2 text-center text-sm font-bold text-red-600 block";
        card.style.transform = "translateX(5px)";
        setTimeout(() => card.style.transform = "translateX(0)", 100);
        setTimeout(() => card.style.transform = "translateX(-5px)", 200);
        setTimeout(() => card.style.transform = "translateX(0)", 300);
    }
}

// Interactive diagram logic
const state = { trident: { found1: false, found2: false } };

function handleFixClick(event, type, containerId) {
    event.stopPropagation();
    event.preventDefault();

    const container = document.getElementById(containerId);
    if (container.classList.contains("solved")) return;

    const svg = container.querySelector(".diagram-svg");
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgP = point.matrixTransform(svg.getScreenCTM().inverse());

    let success = false;
    let snapX;
    let snapY;

    if (type === "trident") {
        if (!state.trident.found1 && Math.hypot(svgP.x - 20, svgP.y - 20) < 15) {
            success = true;
            snapX = 20;
            snapY = 20;
            state.trident.found1 = true;
        } else if (!state.trident.found2 && Math.hypot(svgP.x - 100, svgP.y - 20) < 15) {
            success = true;
            snapX = 100;
            snapY = 20;
            state.trident.found2 = true;
        }
    } else if (type === "envelope") {
        if (Math.hypot(svgP.x - 60, svgP.y - 50) < 15) {
            success = true;
            snapX = 60;
            snapY = 50;
        }
    } else if (type === "circle") {
        if (Math.hypot(svgP.x - 60, svgP.y - 50) > 20 && Math.hypot(svgP.x - 60, svgP.y - 50) < 40) {
            success = true;
            const angle = Math.atan2(svgP.y - 50, svgP.x - 60);
            snapX = 60 + 30 * Math.cos(angle);
            snapY = 50 + 30 * Math.sin(angle);
        }
    }

    if (success) {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.classList.add("post-dot");
        dot.setAttribute("cx", snapX);
        dot.setAttribute("cy", snapY);
        dot.setAttribute("r", "5");
        svg.appendChild(dot);

        if (type === "trident") {
            if (state.trident.found1 && state.trident.found2) container.classList.add("solved");
        } else {
            container.classList.add("solved");
        }
    } else {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-popup";
        errorDiv.textContent = "X Try again";
        errorDiv.style.left = `${event.clientX}px`;
        errorDiv.style.top = `${event.clientY - 20}px`;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 1000);
    }
}

// Table and modal logic
const modal = document.getElementById("modal-overlay");
const modalError = document.getElementById("modal-error");
const inPosts = document.getElementById("in-posts");
const inSegments = document.getElementById("in-segments");
const inRegions = document.getElementById("in-regions");
let tableBody = null;
let activeTableId = "stats-table";

function openModal(targetTableId = "stats-table") {
    activeTableId = targetTableId;
    modal.classList.remove("hidden");
    inPosts.value = "";
    inSegments.value = "";
    inRegions.value = "";
    modalError.classList.add("hidden");
}

function closeModal() {
    modal.classList.add("hidden");
}

function addEntry() {
    const v = parseInt(inPosts.value, 10) || 0;
    const e = parseInt(inSegments.value, 10) || 0;
    const r = parseInt(inRegions.value, 10) || 0;

    if (v - e + r === 1) {
        const activeTableBody = document.getElementById(activeTableId)?.querySelector("tbody");
        if (!activeTableBody) return;

        const row = document.createElement("tr");
        row.className = "border-b last:border-0 border-slate-200";
        row.innerHTML = `
            <td class="w-12 py-4 text-center text-3xl font-bold bg-red-50 text-slate-700">${v}</td>
            <td class="w-12 py-4 text-center text-3xl font-bold bg-blue-50 text-slate-700">${e}</td>
            <td class="w-12 py-4 text-center text-3xl font-bold bg-green-50 text-slate-700">${r}</td>
        `;
        activeTableBody.appendChild(row);
        if (activeTableId === "stats-table") tableBody = activeTableBody;
        modalError.classList.add("hidden");
        closeModal();
    } else {
        modalError.classList.remove("hidden");
    }
}

modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
});

// Sketching tool logic
let canvas = null;
let ctx = null;
let resizeObserver = null;
let sketchToolInitialized = false;

function initializeSketchTool() {
    if (sketchToolInitialized) return;

    tableBody = document.querySelector("#stats-table tbody");
    canvas = document.getElementById("canvas");
    if (!canvas) return;

    ctx = canvas.getContext("2d", { willReadFrequently: true });
    tallyPosts = document.getElementById("tally-posts");
    tallySegs = document.getElementById("tally-segs");
    tallyRegions = document.getElementById("tally-regions");
    tallyContainer = document.getElementById("tally-container");
    statusDiv = document.getElementById("status");

    resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            resizeSketchCanvas(entry.contentRect);
        }
    });
    resizeObserver.observe(canvas.parentElement);

    canvas.addEventListener("pointerdown", e => {
        if (e.pointerType === "touch") e.preventDefault();
        if (sketchMode === "processed") {
            sketchMode = "raw";
            resetTally();
            redrawRawStrokes();
        }
        isDrawing = true;
        canvas.setPointerCapture(e.pointerId);
        currentPoints = [getCoords(e)];
    });

    canvas.addEventListener("pointermove", e => {
        if (isDrawing) {
            if (e.pointerType === "touch") e.preventDefault();
            currentPoints.push(getCoords(e));
            redrawRawStrokes();
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#333";
            ctx.beginPath();
            ctx.moveTo(currentPoints[0][0], currentPoints[0][1]);
            for (let i = 1; i < currentPoints.length; i++) ctx.lineTo(currentPoints[i][0], currentPoints[i][1]);
            ctx.stroke();
        }
    });

    canvas.addEventListener("pointerup", e => {
        isDrawing = false;
        canvas.releasePointerCapture(e.pointerId);

        if (currentPoints.length > 2) {
            const sim = currentPoints.filter((_, i) => i % 2 === 0);
            strokes.push({ points: sim, isLoop: false });
        }

        currentPoints = [];
        resetTally();
        redrawRawStrokes();
    });

    sketchToolInitialized = true;
}

function resizeSketchCanvas(size) {
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const width = Math.round(size && size.width ? size.width : wrapper.clientWidth);
    const height = Math.round(size && size.height ? size.height : wrapper.clientHeight);

    if (width <= 0 || height <= 0) return;
    if (canvas.width !== width || canvas.height !== height) {
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        const shouldScale = oldWidth > 0 && oldHeight > 0;

        if (shouldScale) scaleStoredStrokes(width / oldWidth, height / oldHeight);

        canvas.width = width;
        canvas.height = height;
        if (strokes.length > 0) {
            if (sketchMode === "processed") {
                renderProcessedDiagramFromStrokes(false);
            } else {
                redrawRawStrokes();
            }
        }
    }
}

const EPSILON = 1e-9;

function dist(p1, p2) {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
}

function getIntersection(p0, p1, p2, p3) {
    const s1_x = p1[0] - p0[0];
    const s1_y = p1[1] - p0[1];
    const s2_x = p3[0] - p2[0];
    const s2_y = p3[1] - p2[1];
    const denom = -s2_x * s1_y + s1_x * s2_y;

    if (Math.abs(denom) < EPSILON) return null;

    const s = (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) / denom;
    const t = (s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) / denom;

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return {
            point: [p0[0] + t * s1_x, p0[1] + t * s1_y],
            tA: t,
            tB: s
        };
    }

    return null;
}

class IntersectionGraphBuilder {
    constructor() {
        this.intersectionsMap = new Map();
    }

    getSegKey(sIdx, pIdx) {
        return `${sIdx}:${pIdx}`;
    }

    addIntersection(sIdx, pIdx, point, t) {
        const key = this.getSegKey(sIdx, pIdx);
        if (!this.intersectionsMap.has(key)) this.intersectionsMap.set(key, []);
        const list = this.intersectionsMap.get(key);
        if (!list.some(i => Math.abs(i.t - t) < 1e-7)) list.push({ point, t });
    }

    build(strokesToBuild) {
        this.intersectionsMap.clear();

        strokesToBuild.forEach(stroke => {
            const d = dist(stroke.points[0], stroke.points[stroke.points.length - 1]);
            stroke.isLoop = d < 10.0;
            if (stroke.isLoop && d > EPSILON) stroke.points.push([...stroke.points[0]]);
        });

        for (let i = 0; i < strokesToBuild.length; i++) {
            for (let j = i; j < strokesToBuild.length; j++) {
                const sA = strokesToBuild[i];
                const sB = strokesToBuild[j];

                for (let idxA = 0; idxA < sA.points.length - 1; idxA++) {
                    const startB = i === j ? idxA + 1 : 0;

                    for (let idxB = startB; idxB < sB.points.length - 1; idxB++) {
                        if (i === j && Math.abs(idxA - idxB) < 2) continue;
                        const res = getIntersection(sA.points[idxA], sA.points[idxA + 1], sB.points[idxB], sB.points[idxB + 1]);

                        if (res) {
                            this.addIntersection(i, idxA, res.point, res.tA);
                            this.addIntersection(j, idxB, res.point, res.tB);
                        }
                    }
                }
            }
        }

        const fenceSegments = [];
        strokesToBuild.forEach((stroke, sIdx) => {
            let queue = [];

            if (stroke.isLoop) {
                let cutInfo = null;

                for (let i = 0; i < stroke.points.length - 1; i++) {
                    const key = this.getSegKey(sIdx, i);

                    if (this.intersectionsMap.has(key)) {
                        const inters = this.intersectionsMap.get(key).sort((a, b) => a.t - b.t);
                        cutInfo = { segIdx: i, t: inters[0].t, pt: inters[0].point };
                        break;
                    }
                }

                if (cutInfo) {
                    const k = cutInfo.segIdx;
                    const tCut = cutInfo.t;
                    queue.push({ segIdx: k, pStart: cutInfo.pt, pEnd: stroke.points[k + 1], minT: tCut, maxT: 1.0 });

                    for (let i = k + 1; i < stroke.points.length - 1; i++) {
                        queue.push({ segIdx: i, pStart: stroke.points[i], pEnd: stroke.points[i + 1], minT: 0, maxT: 1 });
                    }

                    for (let i = 0; i < k; i++) {
                        queue.push({ segIdx: i, pStart: stroke.points[i], pEnd: stroke.points[i + 1], minT: 0, maxT: 1 });
                    }

                    queue.push({ segIdx: k, pStart: stroke.points[k], pEnd: cutInfo.pt, minT: 0.0, maxT: tCut });
                } else {
                    queue = this.getStandardQueue(stroke);
                }
            } else {
                queue = this.getStandardQueue(stroke);
            }

            let currSeg = [queue[0].pStart];
            queue.forEach((task, taskIdx) => {
                const key = this.getSegKey(sIdx, task.segIdx);
                let cuts = [];

                if (this.intersectionsMap.has(key)) {
                    cuts = this.intersectionsMap
                        .get(key)
                        .filter(c => c.t > task.minT + EPSILON && c.t < task.maxT - EPSILON)
                        .sort((a, b) => a.t - b.t);
                }

                cuts.forEach(cut => {
                    currSeg.push(cut.point);
                    fenceSegments.push(currSeg);
                    currSeg = [cut.point];
                });

                const isPureLoop = stroke.isLoop && taskIdx === queue.length - 1;
                if (!isPureLoop) currSeg.push(task.pEnd);
            });

            if (currSeg.length > 1) fenceSegments.push(currSeg);
        });

        const posts = new Set();
        const postArr = [];
        fenceSegments.forEach(seg => {
            [seg[0], seg[seg.length - 1]].forEach(p => {
                const key = `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
                if (!posts.has(key)) {
                    posts.add(key);
                    postArr.push({ id: key, pt: p });
                }
            });
        });

        return { segments: fenceSegments, posts: postArr };
    }

    getStandardQueue(stroke) {
        const queue = [];
        for (let i = 0; i < stroke.points.length - 1; i++) {
            queue.push({ segIdx: i, pStart: stroke.points[i], pEnd: stroke.points[i + 1], minT: 0, maxT: 1 });
        }
        return queue;
    }
}

let strokes = [];
let isDrawing = false;
let currentPoints = [];
let sketchMode = "raw";

let tallyPosts = null;
let tallySegs = null;
let tallyRegions = null;
let tallyContainer = null;
let statusDiv = null;
const PALETTE = [
    [255, 179, 186],
    [255, 223, 186],
    [255, 255, 186],
    [186, 255, 201],
    [186, 225, 255],
    [209, 186, 255],
    [255, 192, 203],
    [176, 224, 230],
    [240, 230, 140],
    [221, 160, 221]
];

function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return [
        (e.clientX - rect.left) * (canvas.width / rect.width),
        (e.clientY - rect.top) * (canvas.height / rect.height)
    ];
}

function scaleStoredStrokes(scaleX, scaleY) {
    const scalePoint = point => {
        point[0] *= scaleX;
        point[1] *= scaleY;
    };

    strokes.forEach(stroke => stroke.points.forEach(scalePoint));
    currentPoints.forEach(scalePoint);
}

function resetTally() {
    if (!tallyContainer || !statusDiv) return;

    tallyContainer.classList.remove("opacity-100");
    tallyContainer.classList.add("opacity-0");
    statusDiv.textContent = "";
}

function clearCanvas() {
    if (!canvas || !ctx) return;

    sketchMode = "raw";
    strokes = [];
    currentPoints = [];
    resetTally();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function redrawRawStrokes() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";

    strokes.forEach(stroke => {
        ctx.beginPath();
        if (stroke.points.length) ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        stroke.points.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
    });
}

function processStrokes() {
    if (!ctx) return;

    renderProcessedDiagramFromStrokes(true);
}

function renderProcessedDiagramFromStrokes(showTally) {
    if (!ctx || strokes.length === 0) return;

    try {
        const builder = new IntersectionGraphBuilder();
        const strokeCopy = JSON.parse(JSON.stringify(strokes));
        const topo = builder.build(strokeCopy);
        const regionsFound = renderProcessedDiagram(topo);

        sketchMode = "processed";
        if (statusDiv) statusDiv.textContent = "";
        if (showTally && tallyPosts && tallySegs && tallyRegions && tallyContainer) {
            tallyPosts.textContent = topo.posts.length;
            tallySegs.textContent = topo.segments.length;
            tallyRegions.textContent = regionsFound;
            tallyContainer.classList.remove("opacity-0");
            tallyContainer.classList.add("opacity-100");
        }
    } catch (e) {
        console.error(e);
        if (statusDiv) statusDiv.textContent = e.message;
    }
}

function renderProcessedDiagram(topo) {
    drawSegmentsForRaster(topo.segments);
    const regionsFound = performFloodFill();
    drawSegmentsForDisplay(topo.segments);
    drawPosts(topo.posts);
    return regionsFound;
}

function drawSegmentsForRaster(segments) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";

    segments.forEach(seg => {
        ctx.beginPath();
        ctx.moveTo(seg[0][0], seg[0][1]);
        for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j][0], seg[j][1]);
        ctx.stroke();
    });
}

function drawSegmentsForDisplay(segments) {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";

    segments.forEach(seg => {
        ctx.beginPath();
        ctx.moveTo(seg[0][0], seg[0][1]);
        for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j][0], seg[j][1]);
        ctx.stroke();
    });
}

function drawPosts(posts) {
    ctx.fillStyle = "black";
    posts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.pt[0], p.pt[1], 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function performFloodFill() {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Int32Array(width * height).fill(0);

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        if (r < 128) visited[i] = -1;
    }

    const queue = new Int32Array(width * height);

    function flood(sx, sy, id) {
        let head = 0;
        let tail = 0;
        const startIdx = sy * width + sx;

        if (visited[startIdx] !== 0) return false;

        queue[tail++] = startIdx;
        visited[startIdx] = id;
        let count = 0;

        while (head < tail) {
            const idx = queue[head++];
            count++;

            const cx = idx % width;
            const cy = (idx / width) | 0;
            const nUp = idx - width;
            const nDown = idx + width;
            const nLeft = idx - 1;
            const nRight = idx + 1;

            if (cy > 0 && visited[nUp] === 0) {
                visited[nUp] = id;
                queue[tail++] = nUp;
            }

            if (cy < height - 1 && visited[nDown] === 0) {
                visited[nDown] = id;
                queue[tail++] = nDown;
            }

            if (cx > 0 && visited[nLeft] === 0) {
                visited[nLeft] = id;
                queue[tail++] = nLeft;
            }

            if (cx < width - 1 && visited[nRight] === 0) {
                visited[nRight] = id;
                queue[tail++] = nRight;
            }
        }

        return count > 20;
    }

    flood(0, 0, 1);
    let regionsFound = 0;

    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const idx = y * width + x;

            if (visited[idx] === 0) {
                const regionId = regionsFound + 2;
                if (flood(x, y, regionId)) regionsFound++;
            }
        }
    }

    for (let i = 0; i < width * height; i++) {
        const id = visited[i];

        if (id > 1) {
            const col = PALETTE[(id - 2) % PALETTE.length];
            data[i * 4] = col[0];
            data[i * 4 + 1] = col[1];
            data[i * 4 + 2] = col[2];
        } else if (id === 1) {
            data[i * 4] = 255;
            data[i * 4 + 1] = 255;
            data[i * 4 + 2] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return regionsFound;
}

initializeDeck();
