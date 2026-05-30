// --- Ogden Extension: Watcher-only ---
// Task counter, countdown timer, ADS/Halo modes, auto-detect, daily reset
// No page interaction: reads DOM only, never modifies or injects

// --- Shared State ---
let activeMode = 'ads';
let totalTasks = 0;
let totalAccumulatedSeconds = 0;
let countdown = 90;
let taskTimeSeconds = 90;
let resetHour = 0;

// --- ADS Mode State ---
let adsLastText = null;
let adsCountedCurrent = false;
let adsLastTaskId = null;

// --- Halo Mode State ---
let haloHasSubmittedTask = false;
let haloLastCurrentTaskNumber = null;
let haloLastSubmitTime = 0;

// --- Interval IDs ---
let countdownIntervalId = null;
let adsPollIntervalId = null;
let haloPollIntervalId = null;
let dailyResetIntervalId = null;
let autoDetectIntervalId = null;

// --- Event handler refs for cleanup ---
let haloClickHandler = null;
let adsClickHandler = null;
let adsLastContinueTime = 0;

// --- UI ---
const overlay = document.createElement('div');
overlay.id = 'ads-halo-overlay';
overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(15, 15, 15, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 12px;
    display: flex;
    gap: 12px;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #fff;
    z-index: 999999;
    user-select: none;
    cursor: grab;
    white-space: nowrap;
`;
document.body.appendChild(overlay);

// --- Helpers ---
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function formatCountdown(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderUI() {
    const tasksColor = activeMode === 'halo' ? '#81c784' : '#64ffda';
    const timerColor = countdown <= 10 && countdown > 0 ? '#ff4d4d' : (countdown === 0 ? '#ff4d4d' : '#ffffff');
    const active = hasActiveTask();
    const countdownDisplay = active ? formatCountdown(countdown) : '--:--';
    const countdownColor = active ? timerColor : '#ffffff';
    overlay.innerHTML = `
        <span id="mode-label" style="font-size: 16px; font-weight: 600; color: #ffffff; cursor: pointer;">${activeMode.toUpperCase()}</span>
        <span style="font-size: 16px; font-weight: 600; color: ${tasksColor}; font-variant-numeric: tabular-nums;">${totalTasks}</span>
        <span style="font-size: 16px; font-weight: 600; color: #b388ff; font-variant-numeric: tabular-nums;">${formatTime(totalAccumulatedSeconds)}</span>
        <span style="font-size: 16px; font-weight: 600; color: ${countdownColor}; font-variant-numeric: tabular-nums;">${countdownDisplay}</span>
    `;
    const modeLabel = overlay.querySelector('#mode-label');
    if (modeLabel) {
        modeLabel.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
        modeLabel.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); toggleMode(); });
    }
}

function incrementTask() {
    totalTasks++;
    totalAccumulatedSeconds = totalTasks * taskTimeSeconds;
    saveCurrentModeState(() => {
        saveTodaySnapshot();
    });
    renderUI();
}

function saveCurrentModeState(callback) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        if (callback) callback();
        return;
    }
    const prefix = activeMode === 'ads' ? 'ads' : 'halo';
    const state = {
        [`${prefix}_totalTasks`]: totalTasks,
        [`${prefix}_countdown`]: countdown
    };
    if (activeMode === 'ads') {
        state.ads_lastText = adsLastText;
        state.ads_countedCurrent = adsCountedCurrent;
    } else {
        state.halo_hasSubmittedTask = haloHasSubmittedTask;
        state.halo_lastCurrentTaskNumber = haloLastCurrentTaskNumber;
        state.halo_lastSubmitTime = haloLastSubmitTime;
    }
    chrome.storage.local.set(state, callback);
}

function saveModeSpecificState() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const prefix = activeMode === 'ads' ? 'ads' : 'halo';
    const state = {
        [`${prefix}_totalTasks`]: totalTasks,
        [`${prefix}_countdown`]: countdown
    };
    if (activeMode === 'ads') {
        state.ads_lastText = adsLastText;
        state.ads_countedCurrent = adsCountedCurrent;
    } else {
        state.halo_hasSubmittedTask = haloHasSubmittedTask;
        state.halo_lastCurrentTaskNumber = haloLastCurrentTaskNumber;
        state.halo_lastSubmitTime = haloLastSubmitTime;
    }
    chrome.storage.local.set(state);
}

function loadTaskTimeSeconds(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['taskTimeSeconds', 'resetHour'], (res) => {
            if (res.taskTimeSeconds && res.taskTimeSeconds > 0) {
                taskTimeSeconds = res.taskTimeSeconds;
            }
            if (res.resetHour != null) {
                resetHour = res.resetHour;
            }
            if (callback) callback();
        });
    } else {
        if (callback) callback();
    }
}

// --- Countdown ---
function hasActiveTask() {
    if (activeMode === 'ads') {
        return !!document.querySelector('div._8m9f');
    } else {
        return !!document.querySelector('div._964');
    }
}

function startCountdown() {
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    let tickCount = 0;
    countdownIntervalId = setInterval(() => {
        if (activeMode === 'halo') {
            if (countdown > 0 && hasActiveTask()) {
                countdown--;
            } else if (haloHasSubmittedTask && Date.now() - haloLastSubmitTime > 15000) {
                haloHasSubmittedTask = false;
                countdown = taskTimeSeconds;
            }
        } else {
            if (countdown > 0 && hasActiveTask()) {
                countdown--;
            }
        }
        tickCount++;
        if (tickCount % 15 === 0) saveTodaySnapshot();
        renderUI();
    }, 1000);
}

// --- ADS Mode Logic ---

// Submit detection (reads DOM on click, does not modify page)
function adsHandleContinueDetected() {
    const now = Date.now();
    if (now - adsLastContinueTime < 1000) return;
    adsLastContinueTime = now;
    incrementTask();
    countdown = taskTimeSeconds;
}

function adsClickCallback(e) {
    let current = e.target;
    for (let i = 0; i < 10; i++) {
        if (!current || current === document.body) break;

        if (current.tagName === 'BUTTON') {
            const text = current.textContent ? current.textContent.trim().toLowerCase() : '';
            const innerDiv = current.querySelector('.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft');
            const hasExactSubmitText = innerDiv && innerDiv.textContent.trim().toLowerCase() === 'submit';
            if (hasExactSubmitText || text === 'submit') {
                adsHandleContinueDetected();
                return;
            }
        }

        current = current.parentElement;
    }
}

function adsCheckTaskChange() {
    const taskIdEl = document.querySelector('div._8m9f');
    if (!taskIdEl) {
        adsLastTaskId = null;
        return;
    }
    const taskId = taskIdEl.textContent.trim();
    if (!taskId) return;

    if (taskId !== adsLastTaskId) {
        adsLastTaskId = taskId;
        countdown = taskTimeSeconds;
        renderUI();
    }
}

function startADS() {
    adsPollIntervalId = setInterval(adsCheckTaskChange, 1000);
    adsClickHandler = adsClickCallback;
    document.addEventListener('click', adsClickHandler, true);
}

function stopADS() {
    if (adsPollIntervalId) { clearInterval(adsPollIntervalId); adsPollIntervalId = null; }
    if (adsClickHandler) { document.removeEventListener('click', adsClickHandler, true); adsClickHandler = null; }
}

// --- Halo Mode Logic ---

// Submit detection (reads DOM on click, does not modify page)
function haloHandleSubmitDetected() {
    if (!haloHasSubmittedTask) {
        incrementTask();
        countdown = taskTimeSeconds;
        haloHasSubmittedTask = true;
        haloLastSubmitTime = Date.now();
    }
}

function haloClickCallback(e) {
    let current = e.target;
    let isSubmit = false;

    for (let i = 0; i < 8; i++) {
        if (!current || current === document.body) break;

        const text = (current.textContent || '').trim().toLowerCase();

        if (current.matches && current.matches('.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft') && text === 'submit') {
            isSubmit = true;
            break;
        }

        if (current.tagName === 'BUTTON') {
            const innerDiv = current.querySelector('.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft');
            const hasExactSubmitText = innerDiv && innerDiv.textContent.trim().toLowerCase() === 'submit';
            if (hasExactSubmitText || text === 'submit') {
                isSubmit = true;
                break;
            }
        }

        current = current.parentElement;
    }

    if (isSubmit) {
        haloHandleSubmitDetected();
    }
}

// Task change detection (reads DOM only)
function haloCheckTaskChange() {
    const progressEl = document.querySelector('div._964');
    if (!progressEl) {
        haloLastCurrentTaskNumber = null;
        return;
    }

    const text = progressEl.textContent.trim();
    const match = text.match(/^(\d+)\s+out\s+of\s+(\d+)/i);
    if (!match) return;

    const currentTaskNumber = parseInt(match[1], 10);

    if (currentTaskNumber !== haloLastCurrentTaskNumber) {
        haloLastCurrentTaskNumber = currentTaskNumber;
        countdown = taskTimeSeconds;
        haloHasSubmittedTask = false;
        renderUI();
    }
}

function startHalo() {
    haloHasSubmittedTask = false;
    haloPollIntervalId = setInterval(haloCheckTaskChange, 500);
    haloClickHandler = haloClickCallback;
    document.addEventListener('click', haloClickHandler, true);
}

function stopHalo() {
    if (haloPollIntervalId) { clearInterval(haloPollIntervalId); haloPollIntervalId = null; }
    if (haloClickHandler) { document.removeEventListener('click', haloClickHandler, true); haloClickHandler = null; }
}

// --- Auto-Detect Mode ---
function autoDetectMode() {
    const adsEl = document.querySelector('div.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft');
    const haloEl = document.querySelector('span._55pe');

    let detected = null;
    if (adsEl && adsEl.textContent.trim().toLowerCase() === 'ads integrity') {
        detected = 'ads';
    } else if (haloEl && haloEl.textContent.trim().toLowerCase() === 'halo') {
        detected = 'halo';
    }

    if (detected && detected !== activeMode) {
        toggleMode();
    }
}

function startAutoDetect() {
    autoDetectIntervalId = setInterval(autoDetectMode, 2000);
}

function stopAutoDetect() {
    if (autoDetectIntervalId) {
        clearInterval(autoDetectIntervalId);
        autoDetectIntervalId = null;
    }
}

// --- Mode Toggle ---
function toggleMode() {
    saveModeSpecificState();

    if (activeMode === 'ads') {
        stopADS();
        activeMode = 'halo';
    } else {
        stopHalo();
        activeMode = 'ads';
    }

    loadModeState(() => {
        startCountdown();
        renderUI();

        if (activeMode === 'ads') {
            startADS();
        } else {
            startHalo();
        }
    });

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ activeMode });
    }
}

function loadModeState(callback) {
    const prefix = activeMode === 'ads' ? 'ads' : 'halo';
    if (typeof chrome !== 'undefined' && chrome.storage) {
        const keys = [
            `${prefix}_totalTasks`,
            `${prefix}_countdown`,
            ...(activeMode === 'ads' ? ['ads_lastText', 'ads_countedCurrent'] : ['halo_hasSubmittedTask', 'halo_lastCurrentTaskNumber', 'halo_lastSubmitTime'])
        ];
        chrome.storage.local.get(keys, (res) => {
            totalTasks = res[`${prefix}_totalTasks`] || 0;
            totalAccumulatedSeconds = totalTasks * taskTimeSeconds;
            countdown = res[`${prefix}_countdown`] != null ? res[`${prefix}_countdown`] : taskTimeSeconds;
            if (activeMode === 'ads') {
                adsLastText = res.ads_lastText || null;
                adsCountedCurrent = res.ads_countedCurrent || false;
            } else {
                haloHasSubmittedTask = res.halo_hasSubmittedTask || false;
                haloLastCurrentTaskNumber = res.halo_lastCurrentTaskNumber != null ? res.halo_lastCurrentTaskNumber : null;
                haloLastSubmitTime = res.halo_lastSubmitTime || 0;
            }
            renderUI();
            if (callback) callback();
        });
    } else {
        renderUI();
        if (callback) callback();
    }
}

// --- Daily Reset ---
function getLocalDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayDateStr() {
    const now = new Date();
    const hour = now.getHours();
    if (hour < resetHour) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return getLocalDateStr(d);
    }
    return getLocalDateStr(now);
}

function getNowHourStr() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

function saveTodaySnapshot() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const dateStr = getTodayDateStr();
    const hourStr = getNowHourStr();

    chrome.storage.local.get(['todayEntry', 'ads_totalTasks', 'halo_totalTasks'], (res) => {
        const prev = res.todayEntry;

        if (prev && prev.date !== dateStr) {
            finalizeDay(prev);
            chrome.storage.local.set({
                todayEntry: null,
                ads_totalTasks: 0,
                halo_totalTasks: 0,
                ads_lastDate: dateStr,
                halo_lastDate: dateStr,
                ads_lastText: null,
                ads_countedCurrent: false
            });
            totalTasks = 0;
            totalAccumulatedSeconds = 0;
            adsLastText = null;
            adsCountedCurrent = false;
            adsLastTaskId = null;
            haloHasSubmittedTask = false;
            haloLastCurrentTaskNumber = null;
            renderUI();
            const entry = {
                date: dateStr,
                hour: hourStr,
                adsTasks: 0,
                adsTime: 0,
                haloTasks: 0,
                haloTime: 0
            };
            chrome.storage.local.set({ todayEntry: entry });
        } else {
            const adsTasks = res.ads_totalTasks || 0;
            const haloTasks = res.halo_totalTasks || 0;
            const entry = {
                date: dateStr,
                hour: hourStr,
                adsTasks: adsTasks,
                adsTime: adsTasks * taskTimeSeconds,
                haloTasks: haloTasks,
                haloTime: haloTasks * taskTimeSeconds
            };
            chrome.storage.local.set({ todayEntry: entry });
        }
    });
}

function finalizeDay(entry) {
    if (!entry) return;
    chrome.storage.local.get(['dailyHistory'], (res) => {
        let daily = res.dailyHistory || [];
        const idx = daily.findIndex(d => d.date === entry.date);
        const dailyEntry = {
            date: entry.date,
            adsTasks: entry.adsTasks,
            adsTime: entry.adsTime,
            haloTasks: entry.haloTasks,
            haloTime: entry.haloTime,
            taskTimeSeconds: taskTimeSeconds
        };
        if (idx >= 0) {
            daily[idx] = dailyEntry;
        } else {
            daily.push(dailyEntry);
        }
        if (daily.length > 90) daily = daily.slice(-90);
        chrome.storage.local.set({ dailyHistory: daily });
    });
}

function checkNewDay() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local.get(['dailyResetEnabled'], (res) => {
        if (res.dailyResetEnabled === false) return;

        const now = new Date();
        const dateStr = getTodayDateStr();

        chrome.storage.local.get(['ads_lastDate', 'halo_lastDate'], (res) => {
            const adsDate = res.ads_lastDate;
            const haloDate = res.halo_lastDate;

            const adsNeedsReset = adsDate && adsDate !== dateStr;
            const haloNeedsReset = haloDate && haloDate !== dateStr;

            if (adsNeedsReset || haloNeedsReset) {
                chrome.storage.local.get(['todayEntry'], (innerRes) => {
                    finalizeDay(innerRes.todayEntry);
                    chrome.storage.local.set({ todayEntry: null });
                });
            }

            if (adsNeedsReset) {
                chrome.storage.local.set({
                    ads_totalTasks: 0,
                    ads_lastDate: dateStr,
                    ads_lastText: null,
                    ads_countedCurrent: false
                });
                if (activeMode === 'ads') {
                    totalTasks = 0;
                    totalAccumulatedSeconds = 0;
                    adsLastText = null;
                    adsCountedCurrent = false;
                    adsLastTaskId = null;
                    renderUI();
                }
            } else {
                chrome.storage.local.set({ ads_lastDate: dateStr });
            }

            if (haloNeedsReset) {
                chrome.storage.local.set({
                    halo_totalTasks: 0,
                    halo_lastDate: dateStr
                });
                if (activeMode === 'halo') {
                    totalTasks = 0;
                    totalAccumulatedSeconds = 0;
                    renderUI();
                }
            } else {
                chrome.storage.local.set({ halo_lastDate: dateStr });
            }
        });
    });
}

// --- Drag ---
let isDragging = false;
let currentX = 0, currentY = 0, initialX, initialY, xOffset = 0, yOffset = 0;

if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['overlayPos'], (res) => {
        if (res.overlayPos) {
            xOffset = res.overlayPos.x;
            yOffset = res.overlayPos.y;
            currentX = xOffset;
            currentY = yOffset;
            overlay.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        } else {
            const savedPos = localStorage.getItem('min-task-pos');
            if (savedPos) {
                try {
                    const pos = JSON.parse(savedPos);
                    xOffset = pos.x;
                    yOffset = pos.y;
                    currentX = pos.x;
                    currentY = pos.y;
                    overlay.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
                } catch (e) {}
            }
        }
    });
} else {
    const savedPos = localStorage.getItem('min-task-pos');
    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            xOffset = pos.x;
            yOffset = pos.y;
            currentX = pos.x;
            currentY = pos.y;
            overlay.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        } catch (e) {}
    }
}

overlay.addEventListener('mousedown', (e) => {
    if (e.target.id === 'mode-label') return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    overlay.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        overlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        overlay.style.cursor = 'grab';
        const pos = { x: currentX, y: currentY };
        localStorage.setItem('min-task-pos', JSON.stringify(pos));
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ overlayPos: pos });
        }
    }
});

// --- Message Listener (popup -> content script) ---
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.taskTimeSeconds) {
            loadTaskTimeSeconds(() => {
                totalAccumulatedSeconds = totalTasks * taskTimeSeconds;
                countdown = taskTimeSeconds;
                renderUI();
                saveTodaySnapshot();
            });
        }
        if (changes.resetHour) {
            loadTaskTimeSeconds(() => {
                chrome.storage.local.get(['todayEntry'], (res) => {
                    finalizeDay(res.todayEntry);
                });
                chrome.storage.local.set({
                    ads_totalTasks: 0,
                    halo_totalTasks: 0,
                    ads_lastDate: null,
                    halo_lastDate: null,
                    todayEntry: null
                });
                totalTasks = 0;
                totalAccumulatedSeconds = 0;
                countdown = taskTimeSeconds;
                haloHasSubmittedTask = false;
                haloLastCurrentTaskNumber = null;
                adsLastText = null;
                adsCountedCurrent = false;
                adsLastTaskId = null;
                renderUI();
            });
        }
        if (changes.ads_totalTasks || changes.halo_totalTasks) {
            loadModeState(() => {
                renderUI();
                saveTodaySnapshot();
            });
        }
    });
}

// --- Init ---
function init() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['activeMode'], (localRes) => {
            activeMode = localRes.activeMode || 'ads';
            loadTaskTimeSeconds(() => {
                loadModeState(() => {
                    startCountdown();
                    renderUI();
                    checkNewDay();
                    if (!dailyResetIntervalId) dailyResetIntervalId = setInterval(checkNewDay, 60000 * 60);
                    if (!autoDetectIntervalId) startAutoDetect();

                    if (activeMode === 'ads') {
                        startADS();
                    } else {
                        startHalo();
                    }

                    setTimeout(saveTodaySnapshot, 2000);
                });
            });
        });
    } else {
        loadTaskTimeSeconds(() => {
            loadModeState(() => {
                startCountdown();
                startADS();
                renderUI();
            });
        });
        startAutoDetect();
        checkNewDay();
        dailyResetIntervalId = setInterval(checkNewDay, 60000 * 60);
    }
}

init();
