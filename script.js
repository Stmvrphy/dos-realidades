// ============================================================================
// Dos realidades — Ejercicio 02 (DPPI 2026)
// MediaPipe Hands (existente) + IEM + Gráficos cuantificados + Sistema B mejorado
// ============================================================================

// ---------------------------------------------------------------------------
// Constantes de configuración
// ---------------------------------------------------------------------------
const HANDS_CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";

const MOTION_COLS      = 48;
const MOTION_ROWS      = 36;
const MOTION_THRESHOLD = 9;    // umbral mínimo de cambio
const MOTION_MID_THR   = 28;   // entre 9 y 28: bajo (azul); entre 28 y 55: medio (amarillo)
const MOTION_HIGH_THR  = 55;   // >= 55: alto / drástico (rojo)
const MAX_PARTICLES    = 900;

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Umbrales de detección de movimiento
const DIR_THRESHOLD      = 0.016;  // unidades normalizadas por frame
const DIR_COOLDOWN_MS    = 150;    // ms entre eventos del mismo sentido
const GEN_MOVE_THR       = 0.008;
const GEN_MOVE_COOLDOWN  = 100;
const FINGER_MOVE_THR    = 0.012;
const FINGER_MOVE_CD     = 200;

// IEM: buffer de suavizado
const IEM_BUFFER_SIZE = 45;

// ---------------------------------------------------------------------------
// Referencias DOM
// ---------------------------------------------------------------------------
const video        = document.getElementById("video");
const canvasA      = document.getElementById("canvasA");
const ctxA         = canvasA.getContext("2d");
const canvasB      = document.getElementById("canvasB");
const ctxB         = canvasB.getContext("2d");
const hiddenSample = document.getElementById("hiddenSample");
const ctxHidden    = hiddenSample.getContext("2d", { willReadFrequently: true });

const startBtn         = document.getElementById("startBtn");
const cameraBtnWrapper = document.getElementById("cameraBtnWrapper");
const timerBtn         = document.getElementById("timerBtn");
const timerBtnWrapper  = document.getElementById("timerBtnWrapper");
const timerCountdown   = document.getElementById("timerCountdown");
const statusMsg        = document.getElementById("statusMsg");
const idleHintA        = document.getElementById("idleHintA");
const statA            = document.getElementById("statA");
const statB            = document.getElementById("statB");

// IEM
const iemValueEl    = document.getElementById("iemValue");
const iemCategoryEl = document.getElementById("iemCategory");
const iemBarFillEl  = document.getElementById("iemBarFill");
const iemMotLow     = document.getElementById("iemMotLow");
const iemMotMid     = document.getElementById("iemMotMid");
const iemMotHigh    = document.getElementById("iemMotHigh");

// Resultado
const panelResult   = document.getElementById("panelResult");
const resultCatEl   = document.getElementById("resultCategory");
const resultMetrics = document.getElementById("resultMetrics");

// Gráficos — barras de dirección
const dirUpFill    = document.getElementById("dirUpFill");
const dirDownFill  = document.getElementById("dirDownFill");
const dirLeftFill  = document.getElementById("dirLeftFill");
const dirRightFill = document.getElementById("dirRightFill");
const dirUpCount   = document.getElementById("dirUpCount");
const dirDownCount = document.getElementById("dirDownCount");
const dirLeftCount = document.getElementById("dirLeftCount");
const dirRightCount= document.getElementById("dirRightCount");
const dirYMax = document.getElementById("dirYMax");
const dirY75  = document.getElementById("dirY75");
const dirY50  = document.getElementById("dirY50");
const dirY25  = document.getElementById("dirY25");

// Gráficos — barras de dedos
const fgrOpensFill  = document.getElementById("fgrOpensFill");
const fgrClosesFill = document.getElementById("fgrClosesFill");
const fgrMovingFill = document.getElementById("fgrMovingFill");
const fgrAvgFill    = document.getElementById("fgrAvgFill");
const fgrOpensCount = document.getElementById("fgrOpensCount");
const fgrClosesCount= document.getElementById("fgrClosesCount");
const fgrMovingCount= document.getElementById("fgrMovingCount");
const fgrAvgCount   = document.getElementById("fgrAvgCount");
const fgrYMax = document.getElementById("fgrYMax");
const fgrY75  = document.getElementById("fgrY75");
const fgrY50  = document.getElementById("fgrY50");
const fgrY25  = document.getElementById("fgrY25");

// ---------------------------------------------------------------------------
// Estado general
// ---------------------------------------------------------------------------
let handsDetector    = null;
let latestHandResult = null;
let isDetectingHand  = false;
let lastVideoTime    = -1;
let running          = false;
let prevLuma         = null;
let particles        = [];
let smoothMotion     = 0;

// Timer
let timerInterval    = null;
let timerSecondsLeft = 0;
let timerEndTimeout  = null;
let timerFadeTimeout = null;
let timerActive      = false;
let timerStartTime   = 0;

// ---------------------------------------------------------------------------
// Estado de análisis IEM (se resetea al iniciar timer)
// ---------------------------------------------------------------------------
const dirCounts  = { up: 0, down: 0, left: 0, right: 0 };
const fingerActs = { opens: 0, closes: 0, movingExt: 0, extendedTotal: 0, extFrames: 0 };
const motionCounts = { low: 0, mid: 0, high: 0 };

let generalMovements  = 0;
let velocitySum       = 0;
let velocityFrames    = 0;

let prevCentroid      = null;
let prevHandOpen      = null;   // true=abierta, false=cerrada
let prevFingertips    = null;   // cache de posiciones de yemas

let lastDirTime  = { up: 0, down: 0, left: 0, right: 0 };
let lastGenMove  = 0;
let lastFgrMove  = 0;

const iemBuffer  = [];
let currentIEM   = 0;
let currentCat   = "PASIVO";

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
startBtn.addEventListener("click", start);
if (timerBtn) timerBtn.addEventListener("click", startTimer);

async function start() {
  startBtn.disabled = true;
  setStatus("Solicitando acceso a la cámara…");
  try {
    await initCamera();
  } catch (err) {
    setStatus("No se pudo acceder a la cámara: " + (err?.message ?? "revisa los permisos."));
    startBtn.disabled = false;
    return;
  }
  running = true;
  cameraBtnWrapper.classList.add("is-live");
  requestAnimationFrame(renderLoop);
  setStatus("Cámara activa. Cargando visión de manos…");
  try {
    await initHands();
    setStatus("Listo. Visión de manos activa.");
  } catch (err) {
    console.error("initHands:", err);
    setStatus("Error al cargar la visión de manos.");
  }
}

function setStatus(text) { if (statusMsg) statusMsg.textContent = text; }

// ---------------------------------------------------------------------------
// Temporizador
// ---------------------------------------------------------------------------
function startTimer() {
  // Limpiar timers anteriores
  if (timerInterval)    { clearInterval(timerInterval);  timerInterval = null; }
  if (timerFadeTimeout) { clearTimeout(timerFadeTimeout); timerFadeTimeout = null; }
  if (timerEndTimeout)  { clearTimeout(timerEndTimeout);  timerEndTimeout = null; }

  // Resetear datos de análisis
  dirCounts.up = dirCounts.down = dirCounts.left = dirCounts.right = 0;
  fingerActs.opens = fingerActs.closes = fingerActs.movingExt = 0;
  fingerActs.extendedTotal = fingerActs.extFrames = 0;
  motionCounts.low = motionCounts.mid = motionCounts.high = 0;
  generalMovements = velocitySum = velocityFrames = 0;
  prevCentroid = null; prevHandOpen = null; prevFingertips = null;
  lastDirTime.up = lastDirTime.down = lastDirTime.left = lastDirTime.right = 0;
  lastGenMove = lastFgrMove = 0;
  iemBuffer.length = 0;
  currentIEM = 0; currentCat = "PASIVO";

  if (iemMotLow)  iemMotLow.textContent  = "0%";
  if (iemMotMid)  iemMotMid.textContent  = "0%";
  if (iemMotHigh) iemMotHigh.textContent = "0%";

  // Resetear barras visualmente
  [dirUpFill,dirDownFill,dirLeftFill,dirRightFill,
   fgrOpensFill,fgrClosesFill,fgrMovingFill,fgrAvgFill].forEach(el => { if (el) el.style.height = "0%"; });
  [dirUpCount,dirDownCount,dirLeftCount,dirRightCount].forEach(el => { if (el) el.textContent = "0"; });
  [fgrOpensCount,fgrClosesCount,fgrMovingCount].forEach(el => { if (el) el.textContent = "0"; });
  if (fgrAvgCount) fgrAvgCount.textContent = "0.0";
  ["dirYMax","dirY75","dirY50","dirY25","fgrYMax","fgrY75","fgrY50","fgrY25"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "—";
  });

  // Ocultar panel de resultado anterior
  if (panelResult) panelResult.hidden = true;

  // Actualizar IEM display
  if (iemValueEl)    iemValueEl.textContent = "0";
  if (iemCategoryEl) iemCategoryEl.textContent = "PASIVO";
  if (iemBarFillEl)  iemBarFillEl.style.width = "0%";

  timerSecondsLeft = 60;
  timerStartTime   = performance.now();
  timerActive      = true;

  if (timerCountdown) {
    timerCountdown.classList.remove("is-done", "is-fading");
    updateTimerDisplay(60);
  }
  if (timerBtnWrapper) timerBtnWrapper.classList.add("is-live");

  timerInterval = setInterval(() => {
    timerSecondsLeft--;
    if (timerSecondsLeft <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      timerActive = false;
      if (timerCountdown) { updateTimerDisplay(0); timerCountdown.classList.add("is-done"); }
      if (timerBtnWrapper) timerBtnWrapper.classList.remove("is-live");
      showResult();
      timerFadeTimeout = setTimeout(() => {
        if (timerCountdown) timerCountdown.classList.add("is-fading");
        timerEndTimeout = setTimeout(() => {
          if (timerCountdown) { timerCountdown.textContent = ""; timerCountdown.classList.remove("is-done","is-fading"); }
        }, 350);
      }, 700);
    } else {
      if (timerCountdown) updateTimerDisplay(timerSecondsLeft);
    }
  }, 1000);
}

function updateTimerDisplay(s) {
  const m = Math.floor(s / 60);
  timerCountdown.textContent = `${String(m).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  await new Promise(resolve => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
    const onReady = () => {
      if (video.videoWidth > 0) {
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("canplay", onReady);
        resolve();
      }
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    setTimeout(resolve, 800);
  });
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  video.width = w; video.height = h;
  canvasA.width = w; canvasA.height = h;
  canvasB.width = w; canvasB.height = h;
}

// ---------------------------------------------------------------------------
// MediaPipe Hands — inicialización (sin duplicar instancia)
// ---------------------------------------------------------------------------
async function initHands() {
  if (typeof window.Hands === "undefined") {
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="hands.js"]');
      if (existing && window.Hands) return resolve();
      if (existing) { existing.addEventListener("load", resolve); existing.addEventListener("error", reject); return; }
      const sc = document.createElement("script");
      sc.src = `${HANDS_CDN_BASE}/hands.js`;
      sc.crossOrigin = "anonymous";
      sc.onload = resolve; sc.onerror = reject;
      document.head.appendChild(sc);
    });
  }
  handsDetector = new window.Hands({ locateFile: f => `${HANDS_CDN_BASE}/${f}` });
  handsDetector.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.25,
    minTrackingConfidence: 0.25,
  });

  // onResults — punto de entrada de los landmarks (NO se duplica MediaPipe)
  handsDetector.onResults(results => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      latestHandResult = {
        landmarks:    results.multiHandLandmarks,
        handednesses: results.multiHandedness
          ? results.multiHandedness.map(h => [{
              categoryName: h.label,
              displayName:  h.label,
              score:        h.score,
            }])
          : [],
      };
    } else {
      latestHandResult = null;
    }
  });

  // Calentamiento inicial — necesario para que el modelo WASM inicialice correctamente
  if (video.readyState >= 2 && video.videoWidth > 0) {
    isDetectingHand = true;
    lastVideoTime = video.currentTime;
    try {
      await handsDetector.send({ image: video });
    } catch (_) {}
    finally {
      isDetectingHand = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------
function renderLoop() {
  if (!running) return;
  try {
    if (video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
      // 1. Detección continua de manos en segundo plano (solo cuando hay un fotograma nuevo)
      if (handsDetector && !isDetectingHand && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        isDetectingHand = true;
        handsDetector
          .send({ image: video })
          .catch((err) => {
            console.warn("Aviso en handsDetector.send:", err);
          })
          .finally(() => {
            isDetectingHand = false;
          });
      }
      // 2. Dibujar Sistema A
      try { drawSystemA(latestHandResult); } catch(e) { console.error("SistA:", e); }
      // 3. Analizar manos para IEM (solo con timer activo)
      if (timerActive && latestHandResult) {
        try { analyzeHands(latestHandResult); } catch(e) { console.error("analyzeHands:", e); }
      }
      // 4. Dibujar Sistema B
      try { drawSystemB(); } catch(e) { console.error("SistB:", e); }
    }
  } catch(e) { console.error("renderLoop:", e); }
  finally { if (running) requestAnimationFrame(renderLoop); }
}

// ---------------------------------------------------------------------------
// SISTEMA A — Solo puntos blancos, sin líneas, radio 250%
// ---------------------------------------------------------------------------
function drawSystemA(handResult) {
  const w = canvasA.width, h = canvasA.height;
  const t = performance.now() / 1000;

  ctxA.fillStyle = "#07060c";
  ctxA.fillRect(0, 0, w, h);

  const hands = handResult?.landmarks?.length ? handResult.landmarks : null;

  if (!hands) {
    idleHintA.style.opacity = "1";
    statA.textContent = "esperando manos…";
    drawIdlePulse(ctxA, w, h, t);
    return;
  }

  idleHintA.style.opacity = "0";
  statA.textContent = hands.length === 1 ? "Manos: 1 detectada" : `Manos: ${hands.length} detectadas`;

  const TIP_INDICES = new Set([4, 8, 12, 16, 20]);

  hands.forEach(handLandmarks => {
    handLandmarks.forEach((p, idx) => {
      if (!p) return;
      // Radio original: 3.0 (joints) y 4.2 (tips) → ×2.5 = 7.5 / 10.5
      const radius = TIP_INDICES.has(idx) ? 4.2 * 2.5 : 3.0 * 2.5;
      ctxA.fillStyle = "#ffffff";
      ctxA.beginPath();
      ctxA.arc(p.x * w, p.y * h, radius, 0, Math.PI * 2);
      ctxA.fill();
    });
  });
}

function drawIdlePulse(ctx, w, h, t) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 3; i++) {
    const phase = t * 0.9 + i * 0.7;
    const r     = 20 + ((phase * 40) % 140);
    const alpha = clamp(1 - r / 160, 0, 0.5);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,209,102,${alpha})`;
    ctx.lineWidth   = 1.5;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// ANÁLISIS DE MANOS — IEM, dirección, dedos (usa landmarks de MediaPipe ya recibidos)
// ---------------------------------------------------------------------------
function analyzeHands(handResult) {
  const hands = handResult?.landmarks?.length ? handResult.landmarks : null;
  if (!hands || hands.length === 0) {
    prevCentroid = null; prevHandOpen = null; prevFingertips = null;
    return;
  }

  const now  = performance.now();
  const hand = hands[0]; // mano primaria

  // -- Centroide --
  let cx = 0, cy = 0;
  for (const p of hand) { cx += p.x; cy += p.y; }
  cx /= hand.length; cy /= hand.length;

  if (prevCentroid) {
    const dx   = cx - prevCentroid.x;
    const dy   = cy - prevCentroid.y;
    const dist = Math.hypot(dx, dy);

    // Velocidad para IEM
    velocitySum    += dist;
    velocityFrames++;

    // Movimiento general
    if (dist > GEN_MOVE_THR && (now - lastGenMove) > GEN_MOVE_COOLDOWN) {
      generalMovements++;
      lastGenMove = now;
    }

    // Dirección (pantalla en espejo: dx<0 → usuario mueve DERECHA visualmente)
    if (dy < -DIR_THRESHOLD && (now - lastDirTime.up)    > DIR_COOLDOWN_MS) { dirCounts.up++;    lastDirTime.up    = now; }
    if (dy >  DIR_THRESHOLD && (now - lastDirTime.down)  > DIR_COOLDOWN_MS) { dirCounts.down++;  lastDirTime.down  = now; }
    if (dx < -DIR_THRESHOLD && (now - lastDirTime.right) > DIR_COOLDOWN_MS) { dirCounts.right++; lastDirTime.right = now; }
    if (dx >  DIR_THRESHOLD && (now - lastDirTime.left)  > DIR_COOLDOWN_MS) { dirCounts.left++;  lastDirTime.left  = now; }
  }
  prevCentroid = { x: cx, y: cy };

  // -- Dedos extendidos --
  function isExt(tip, pip) { return hand[tip].y < hand[pip].y; }
  let extCount = 0;
  if (isExt(8,  6))  extCount++;
  if (isExt(12, 10)) extCount++;
  if (isExt(16, 14)) extCount++;
  if (isExt(20, 18)) extCount++;
  // Pulgar (comparación horizontal con PIP)
  if (Math.abs(hand[4].x - hand[0].x) > Math.abs(hand[3].x - hand[0].x)) extCount++;

  fingerActs.extendedTotal += extCount;
  fingerActs.extFrames++;

  // Transición abierta/cerrada
  const isOpen = extCount >= 3;
  if (prevHandOpen !== null && isOpen !== prevHandOpen) {
    if (isOpen) fingerActs.opens++;
    else        fingerActs.closes++;
  }
  prevHandOpen = isOpen;

  // Movimiento de dedos mientras extendidos
  if (extCount >= 3) {
    if (prevFingertips) {
      const tips = [4, 8, 12, 16, 20];
      let tipMove = 0;
      for (const t of tips) {
        tipMove += Math.hypot(hand[t].x - prevFingertips[t].x, hand[t].y - prevFingertips[t].y);
      }
      if (tipMove > FINGER_MOVE_THR && (now - lastFgrMove) > FINGER_MOVE_CD) {
        fingerActs.movingExt++;
        lastFgrMove = now;
      }
    }
    prevFingertips = Object.fromEntries([4,8,12,16,20].map(t => [t, { x: hand[t].x, y: hand[t].y }]));
  } else {
    prevFingertips = null;
  }

  // -- IEM -- calcula, suaviza y muestra
  const rawIEM = computeCurrentIEM();
  iemBuffer.push(rawIEM);
  if (iemBuffer.length > IEM_BUFFER_SIZE) iemBuffer.shift();
  currentIEM = Math.round(iemBuffer.reduce((a,b) => a+b, 0) / iemBuffer.length);
  currentCat = getCategory(currentIEM);

  updateIEMDisplay();
  updateCharts();
}

// ---------------------------------------------------------------------------
// IEM — cálculo (fórmula ponderada)
// ---------------------------------------------------------------------------
function computeCurrentIEM() {
  const elapsed = Math.max(0.5, (performance.now() - timerStartTime) / 1000);

  // Cada componente normalizado a [0,1] con frecuencias objetivo
  const genScore = Math.min(1, generalMovements             / (elapsed * 1.5));   // 20%
  const udScore  = Math.min(1, (dirCounts.up + dirCounts.down) / (elapsed * 0.45)); // 15%
  const lrScore  = Math.min(1, (dirCounts.left + dirCounts.right) / (elapsed * 0.45)); // 15%
  const ocScore  = Math.min(1, (fingerActs.opens + fingerActs.closes) / (elapsed * 0.45)); // 15%
  const extScore = Math.min(1, fingerActs.movingExt         / (elapsed * 0.9));   // 10%

  // Velocidad / Intensidad (25%):
  // Combina la cinemática de las manos (MediaPipe) con los niveles de rapidez detectados en Sistema B
  const handVelNorm = velocityFrames > 0
    ? Math.min(1, (velocitySum / velocityFrames) / 0.025)
    : 0;

  const totalMot = motionCounts.low + motionCounts.mid + motionCounts.high;
  let motionIntensity = 0;
  if (totalMot > 0) {
    // Bajo (leve) = 0.20, Medio (moderado) = 0.65, Alto (drástico) = 1.00
    motionIntensity = (motionCounts.low * 0.20 + motionCounts.mid * 0.65 + motionCounts.high * 1.0) / totalMot;
  }

  const velScore = totalMot > 0
    ? Math.min(1, handVelNorm * 0.45 + motionIntensity * 0.55)
    : handVelNorm;

  return Math.min(100, Math.round(
    genScore * 20 +
    udScore  * 15 +
    lrScore  * 15 +
    ocScore  * 15 +
    extScore * 10 +
    velScore * 25
  ));
}

function updateMotionBadges() {
  const total = motionCounts.low + motionCounts.mid + motionCounts.high;
  const pLow  = total > 0 ? Math.round((motionCounts.low  / total) * 100) : 0;
  const pMid  = total > 0 ? Math.round((motionCounts.mid  / total) * 100) : 0;
  const pHigh = total > 0 ? Math.round((motionCounts.high / total) * 100) : 0;

  if (iemMotLow)  iemMotLow.textContent  = `${pLow}%`;
  if (iemMotMid)  iemMotMid.textContent  = `${pMid}%`;
  if (iemMotHigh) iemMotHigh.textContent = `${pHigh}%`;
}

function getCategory(iem) {
  if (iem <= 20) return "PASIVO";
  if (iem <= 40) return "CONTENIDO";
  if (iem <= 60) return "NEUTRO";
  if (iem <= 80) return "ANIMADO";
  return "MUY EXPRESIVO";
}

// ---------------------------------------------------------------------------
// Actualizar display IEM en tiempo real
// ---------------------------------------------------------------------------
function updateIEMDisplay() {
  if (iemValueEl)    iemValueEl.textContent = currentIEM;
  if (iemCategoryEl) iemCategoryEl.textContent = currentCat;
  if (iemBarFillEl)  iemBarFillEl.style.width = `${currentIEM}%`;
}

// ---------------------------------------------------------------------------
// Actualizar gráficos cuantificados
// ---------------------------------------------------------------------------
function setBar(fillEl, countEl, count, max) {
  if (fillEl)  fillEl.style.height = `${Math.round((count / Math.max(1, max)) * 100)}%`;
  if (countEl) countEl.textContent = count;
}

function updateYAxis(maxEl, y75El, y50El, y25El, maxVal) {
  if (maxEl) maxEl.textContent = maxVal;
  if (y75El) y75El.textContent = Math.round(maxVal * 0.75);
  if (y50El) y50El.textContent = Math.round(maxVal * 0.5);
  if (y25El) y25El.textContent = Math.round(maxVal * 0.25);
}

function updateCharts() {
  // Gráfico 1: Dirección
  const maxDir = Math.max(1, dirCounts.up, dirCounts.down, dirCounts.left, dirCounts.right);
  setBar(dirUpFill,    dirUpCount,    dirCounts.up,    maxDir);
  setBar(dirDownFill,  dirDownCount,  dirCounts.down,  maxDir);
  setBar(dirLeftFill,  dirLeftCount,  dirCounts.left,  maxDir);
  setBar(dirRightFill, dirRightCount, dirCounts.right, maxDir);
  updateYAxis(dirYMax, dirY75, dirY50, dirY25, maxDir);

  // Gráfico 2: Dedos
  const avgExt   = fingerActs.extFrames > 0 ? fingerActs.extendedTotal / fingerActs.extFrames : 0;
  const avgRound = Math.ceil(avgExt);
  const maxFgr   = Math.max(1, fingerActs.opens, fingerActs.closes, fingerActs.movingExt, avgRound);
  setBar(fgrOpensFill,  fgrOpensCount,  fingerActs.opens,    maxFgr);
  setBar(fgrClosesFill, fgrClosesCount, fingerActs.closes,   maxFgr);
  setBar(fgrMovingFill, fgrMovingCount, fingerActs.movingExt, maxFgr);
  // Barra promedio: escala sobre 5 (máximo dedos posible)
  if (fgrAvgFill)  fgrAvgFill.style.height = `${Math.round((avgExt / 5) * 100)}%`;
  if (fgrAvgCount) fgrAvgCount.textContent = avgExt.toFixed(1);
  updateYAxis(fgrYMax, fgrY75, fgrY50, fgrY25, maxFgr);
}

// ---------------------------------------------------------------------------
// Resultado final (aparece al terminar el temporizador)
// ---------------------------------------------------------------------------
function showResult() {
  if (!panelResult) return;

  const avgExt = fingerActs.extFrames > 0
    ? (fingerActs.extendedTotal / fingerActs.extFrames).toFixed(1) : "0.0";
  const avgVel = velocityFrames > 0
    ? (velocitySum / velocityFrames * 100).toFixed(2) : "0.00";

  const totalMot = motionCounts.low + motionCounts.mid + motionCounts.high;
  const pLow  = totalMot > 0 ? Math.round((motionCounts.low  / totalMot) * 100) : 0;
  const pMid  = totalMot > 0 ? Math.round((motionCounts.mid  / totalMot) * 100) : 0;
  const pHigh = totalMot > 0 ? Math.round((motionCounts.high / totalMot) * 100) : 0;

  if (resultCatEl) resultCatEl.textContent = currentCat;
  if (resultMetrics) {
    resultMetrics.innerHTML = `
      <li>↑ Subidas: <strong>${dirCounts.up}</strong></li>
      <li>↓ Bajadas: <strong>${dirCounts.down}</strong></li>
      <li>← Movimientos izquierda: <strong>${dirCounts.left}</strong></li>
      <li>→ Movimientos derecha: <strong>${dirCounts.right}</strong></li>
      <li>✋ Aperturas: <strong>${fingerActs.opens}</strong></li>
      <li>✊ Cierres: <strong>${fingerActs.closes}</strong></li>
      <li>🤚 Mov. dedos extendidos: <strong>${fingerActs.movingExt}</strong></li>
      <li>Prom. dedos extendidos: <strong>${avgExt}</strong></li>
      <li>Velocidad media: <strong>${avgVel}</strong></li>
      <li>🔵 Movimiento bajo (azul): <strong>${pLow}%</strong></li>
      <li>🟡 Movimiento medio (amarillo): <strong>${pMid}%</strong></li>
      <li>🔴 Movimiento alto (rojo): <strong>${pHigh}%</strong></li>
      <li>Índice de expresividad: <strong>${currentIEM} / 100</strong></li>
      <li style="grid-column:1/-1">Estado actual: <strong>${currentCat}</strong></li>
    `;
  }

  panelResult.hidden = false;
  setTimeout(() => panelResult.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
}

// ---------------------------------------------------------------------------
// SISTEMA B — Cuadrados, estela 2 s, 3 niveles de color (Azul, Amarillo, Rojo)
// ---------------------------------------------------------------------------
function drawSystemB() {
  const w = canvasB.width, h = canvasB.height;

  ctxHidden.drawImage(video, 0, 0, MOTION_COLS, MOTION_ROWS);
  const frame     = ctxHidden.getImageData(0, 0, MOTION_COLS, MOTION_ROWS).data;
  const cellCount = MOTION_COLS * MOTION_ROWS;
  if (!prevLuma) prevLuma = new Float32Array(cellCount);

  const cellW = w / MOTION_COLS;
  const cellH = h / MOTION_ROWS;
  let activeCells = 0;

  for (let i = 0; i < cellCount; i++) {
    const px   = i * 4;
    const luma = 0.299 * frame[px] + 0.587 * frame[px+1] + 0.114 * frame[px+2];
    const diff = Math.abs(luma - prevLuma[i]);
    prevLuma[i] = luma;

    if (diff > MOTION_THRESHOLD) {
      activeCells++;

      // Niveles de rapidez:
      // Bajo (< 28): azul
      // Medio (28..55): amarillo (punto medio entre azul y rojo)
      // Alto (>= 55): rojo (drástico)
      let level = "low";
      if (diff >= MOTION_HIGH_THR) {
        level = "high";
      } else if (diff >= MOTION_MID_THR) {
        level = "mid";
      }

      if (timerActive) {
        motionCounts[level]++;
      }

      const col = i % MOTION_COLS;
      const row = Math.floor(i / MOTION_COLS);
      const cnt = Math.min(3, Math.round(diff / 22));
      for (let s = 0; s < cnt; s++) {
        spawnParticle(
          (col + 0.5) * cellW + (Math.random() - 0.5) * cellW,
          (row + 0.5) * cellH + (Math.random() - 0.5) * cellH,
          diff,
          level
        );
      }
    }
  }

  if (timerActive) {
    updateMotionBadges();
  }

  smoothMotion = smoothMotion * 0.85 + (activeCells / cellCount) * 0.15;
  if (statB) statB.textContent = `${Math.round(smoothMotion * 100)}% de la escena en movimiento`;

  // Desvanecimiento con estela larga (2 segundos)
  ctxB.fillStyle = "rgba(5,4,10,0.10)";
  ctxB.fillRect(0, 0, w, h);

  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);

  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97;
    p.life--;
    if (p.life <= 0 || p.x < -10 || p.x > w+10 || p.y < -10 || p.y > h+10) return false;

    const alpha = p.life / p.maxLife;

    // Tres niveles de color según rapidez de movimiento:
    // Leve = Azul | Medio = Amarillo | Rápido/drástico = Rojo
    let hue   = 215;  // Azul
    let sat   = 90;
    let light = 60;
    let blur  = 6;
    if (p.level === "mid") {
      hue   = 48; sat = 100; light = 53; blur = 9;   // Amarillo
    } else if (p.level === "high") {
      hue   = 0; sat = 95; light = 58; blur = 13;    // Rojo
    }

    const side = p.size * 2;  // cuadrado en lugar de círculo
    ctxB.fillStyle   = `hsla(${hue},${sat}%,${light}%,${alpha * 0.88})`;
    ctxB.shadowColor = `hsla(${hue},${sat}%,${light}%,${alpha})`;
    ctxB.shadowBlur  = blur;
    ctxB.fillRect(p.x - p.size, p.y - p.size, side, side);
    return true;
  });

  ctxB.shadowBlur = 0;
}

function spawnParticle(x, y, magnitude, level) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.min(2.2, magnitude / 40);
  // Vida ≈ 2 segundos a 60fps (120 frames)
  const life  = 100 + Math.random() * 20;

  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    level,
    size: 1.5 + Math.min(3.5, magnitude / 20),
    life, maxLife: life,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapRange(val, inMin, inMax, outMin, outMax) {
  if (Math.abs(inMax - inMin) < 0.0001) return outMin;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------------------------------------------------------------------------
// Paralaje del fondo (130% viewport, mueve entre −8% y +8% en scroll)
// ---------------------------------------------------------------------------
(function initParallax() {
  const bg = document.querySelector(".page-bg");
  if (!bg) return;
  let raf = false;
  function update() {
    const s  = window.scrollY;
    const mx = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    bg.style.transform = `translateY(${((s / mx) * 16 - 8).toFixed(2)}%)`;
    raf = false;
  }
  window.addEventListener("scroll", () => { if (!raf) { raf = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
