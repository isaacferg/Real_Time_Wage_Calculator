
const $ = (sel) => document.querySelector(sel);
const fmtCurrency = (n) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
const pad = (n) => String(n).padStart(2, "0");
const fmtHMS = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const wageInput = $("#wage");
const saveWageBtn = $("#saveWage");
const elapsedEl = $("#elapsed");
const earnedEl = $("#earned");

const startBtn = $("#start");
const pauseBtn = $("#pause");
const resumeBtn = $("#resume");
const endBtn = $("#end");
const resetBtn = $("#reset");

const historyList = $("#history");
const exportCsvBtn = $("#exportCsv");
const clearHistoryBtn = $("#clearHistory");

let wage = parseFloat(localStorage.getItem("tim_hourly_wage") || "0") || 0;
let running = false;
let paused = false;
let startTime = 0;
let accumulatedMs = 0;
let rafId = null;

if (!localStorage.getItem("tim_history")) {
  localStorage.setItem("tim_history", JSON.stringify([]));
}

function loadWage() {
  if (wageInput && wage > 0) wageInput.value = wage.toFixed(2);
  updateButtons();
}

function saveWage() {
  if (!wageInput) return;
  const v = parseFloat(wageInput.value);
  if (!isFinite(v) || v <= -0.1) {
    alert("Please enter a valid hourly wage.");
    return;
  }
  wage = v;
  localStorage.setItem("tim_hourly_wage", String(wage));
  updateDisplay();
  updateButtons();
}

function updateButtons() {
  if (!startBtn || !pauseBtn || !resumeBtn || !endBtn || !resetBtn) return;
  startBtn.disabled = running || wage <= 0;
  pauseBtn.disabled = !running || paused;
  resumeBtn.disabled = !running || !paused;
  endBtn.disabled = !running;
  resetBtn.disabled = running && !paused ? true : accumulatedMs === 0;
}

function updateDisplay() {
  if (!elapsedEl || !earnedEl) return;
  const elapsedMs = running
    ? Date.now() - startTime + accumulatedMs
    : accumulatedMs;
  const elapsedSec = Math.max(0, elapsedMs / 1000);
  elapsedEl.textContent = fmtHMS(elapsedSec);
  const earned = (elapsedSec / 3600) * (wage || 0);
  earnedEl.textContent = fmtCurrency(earned);
}

function tick() {
  updateDisplay();
  if (running) rafId = requestAnimationFrame(tick);
}

function startShift() {
  if (wage <= 0) {
    alert("Set your hourly wage first.");
    return;
  }
  running = true;
  paused = false;
  startTime = Date.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
  updateButtons();
}

function pauseShift() {
  if (!running) return;
  accumulatedMs += Date.now() - startTime;
  running = true;
  paused = true;
  cancelAnimationFrame(rafId);
  rafId = null;
  updateButtons();
  updateDisplay();
}

function resumeShift() {
  if (!paused) return;
  paused = false;
  startTime = Date.now();
  rafId = requestAnimationFrame(tick);
  updateButtons();
}

function endShift() {
  if (!running) return;
  const endMs = paused ? accumulatedMs : Date.now() - startTime + accumulatedMs;
  const seconds = Math.round(endMs / 1000);
  const amount = (seconds / 3600) * (wage || 0);

  const item = { ts: new Date().toISOString(), seconds, amount, wage };
  const history = JSON.parse(localStorage.getItem("tim_history")) || [];
  history.unshift(item);
  localStorage.setItem("tim_history", JSON.stringify(history));
  renderHistory();

  running = false;
  paused = false;
  startTime = 0;
  accumulatedMs = 0;
  cancelAnimationFrame(rafId);
  rafId = null;
  updateButtons();
  updateDisplay();
}

function resetShift() {
  if (running && !paused) return;
  running = false;
  paused = false;
  startTime = 0;
  accumulatedMs = 0;
  cancelAnimationFrame(rafId);
  rafId = null;
  updateButtons();
  updateDisplay();
}

function renderHistory() {
  if (!historyList) return;
  const history = JSON.parse(localStorage.getItem("tim_history")) || [];
  historyList.innerHTML = "";
  for (const h of history) {
    const li = document.createElement("li");
    const date = new Date(h.ts);
    li.innerHTML = `<strong>${fmtHMS(h.seconds)}</strong> • ${fmtCurrency(
      h.amount
    )} @ $${Number(h.wage).toFixed(
      2
    )}/hr<br><span style="color:var(--muted)">${date.toLocaleString()}</span>`;
    historyList.appendChild(li);
  }
}

function exportCsv() {
  const history = JSON.parse(localStorage.getItem("tim_history") || "[]");
  if (!history.length) {
    alert("No shifts to export.");
    return;
  }
  const rows = [
    ["datetime", "seconds", "formatted_time", "amount_usd", "wage_usd_hr"],
  ];
  for (const h of history)
    rows.push([
      h.ts,
      h.seconds,
      fmtHMS(h.seconds),
      h.amount.toFixed(2),
      Number(h.wage).toFixed(2),
    ]);
  const csv = rows
    .map((r) =>
      r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shifts.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearHistory() {
  if (!confirm("Clear all saved shifts?")) return;
  localStorage.setItem("tim_history", JSON.stringify([]));
  renderHistory();
}

saveWageBtn?.addEventListener("click", saveWage);
startBtn?.addEventListener("click", startShift);
pauseBtn?.addEventListener("click", pauseShift);
resumeBtn?.addEventListener("click", resumeShift);
endBtn?.addEventListener("click", endShift);
resetBtn?.addEventListener("click", resetShift);
exportCsvBtn?.addEventListener("click", exportCsv);
clearHistoryBtn?.addEventListener("click", clearHistory);

// --- Initialize ---
loadWage();
updateDisplay();
renderHistory();