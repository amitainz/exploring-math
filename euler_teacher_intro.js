// Reveal deck setup
function initializeDeck() {
    if (!window.Reveal) return;

    Reveal.initialize({
        controls: true,
        progress: true,
        hash: true,
        slideNumber: "c/t",
        center: false,
        transition: "slide",
        backgroundTransition: "fade",
        width: 1280,
        height: 720,
        margin: 0.04
    }).then(() => {
        resizeSketchCanvas();
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    });

    Reveal.on("slidechanged", () => requestAnimationFrame(resizeSketchCanvas));
}

// Quiz logic
const quizSolutions = { 1: true, 2: false, 3: true };

function checkAnswer(id, userChoiceIsConnected) {
    const isCorrect = userChoiceIsConnected === quizSolutions[id];
    const card = document.getElementById(`q${id}`);
    const feedback = card.querySelector(".q-feedback");
    const buttons = card.querySelectorAll("button");

    if (isCorrect) {
        feedback.textContent = "Correct!";
        feedback.className = "q-feedback mt-2 text-center text-sm font-bold text-green-600 block";
        card.classList.add("border-green-300", "bg-green-50");
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add("opacity-50", "cursor-not-allowed");
        });
    } else {
        feedback.textContent = "Not quite. Look closer at the lines.";
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
        dot.setAttribute("cx", snapX);
        dot.setAttribute("cy", snapY);
        dot.setAttribute("r", "3.5");
        dot.setAttribute("fill", "black");
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
const inFields = document.getElementById("in-fields");
const tableBody = document.querySelector("#stats-table tbody");

function openModal() {
    modal.classList.remove("hidden");
    inPosts.value = "";
    inSegments.value = "";
    inFields.value = "";
    modalError.classList.add("hidden");
}

function closeModal() {
    modal.classList.add("hidden");
}

function addEntry() {
    const v = parseInt(inPosts.value, 10) || 0;
    const e = parseInt(inSegments.value, 10) || 0;
    const f = parseInt(inFields.value, 10) || 0;

    if (v - e + f === 1) {
        const row = document.createElement("tr");
        row.className = "border-b last:border-0 border-slate-200";
        row.innerHTML = `
            <td class="w-12 py-4 text-center text-3xl font-bold bg-red-50 text-slate-700">${v}</td>
            <td class="w-12 py-4 text-center text-3xl font-bold bg-blue-50 text-slate-700">${e}</td>
            <td class="w-12 py-4 text-center text-3xl font-bold bg-green-50 text-slate-700">${f}</td>
        `;
        tableBody.appendChild(row);
        closeModal();
    } else {
        modalError.classList.remove("hidden");
    }
}

modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
});

// Sketching tool logic
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

function resizeSketchCanvas(size) {
    const wrapper = canvas.parentElement;
    const width = Math.round(size && size.width ? size.width : wrapper.clientWidth);
    const height = Math.round(size && size.height ? size.height : wrapper.clientHeight);

    if (width <= 0 || height <= 0) return;
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (strokes.length > 0) redrawRawStrokes();
    }
}

const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
        resizeSketchCanvas(entry.contentRect);
    }
});
resizeObserver.observe(canvas.parentElement);

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

const tallyPosts = document.getElementById("tally-posts");
const tallySegs = document.getElementById("tally-segs");
const tallyFields = document.getElementById("tally-fields");
const tallyContainer = document.getElementById("tally-container");
const statusDiv = document.getElementById("status");
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

canvas.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch") e.preventDefault();
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

function resetTally() {
    tallyContainer.classList.remove("opacity-100");
    tallyContainer.classList.add("opacity-0");
    statusDiv.textContent = "";
}

function clearCanvas() {
    strokes = [];
    resetTally();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function redrawRawStrokes() {
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
    if (strokes.length === 0) return;

    try {
        const builder = new IntersectionGraphBuilder();
        const strokeCopy = JSON.parse(JSON.stringify(strokes));
        const topo = builder.build(strokeCopy);

        tallyPosts.textContent = topo.posts.length;
        tallySegs.textContent = topo.segments.length;
        drawSegmentsForRaster(topo.segments);
        tallyFields.textContent = performFloodFill();
        drawPosts(topo.posts);
        statusDiv.textContent = "";
        tallyContainer.classList.remove("opacity-0");
        tallyContainer.classList.add("opacity-100");
    } catch (e) {
        console.error(e);
        statusDiv.textContent = e.message;
    }
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
    let fieldsFound = 0;

    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const idx = y * width + x;

            if (visited[idx] === 0) {
                const regionId = fieldsFound + 2;
                if (flood(x, y, regionId)) fieldsFound++;
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
    return fieldsFound;
}

initializeDeck();
