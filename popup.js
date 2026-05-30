const adsInput = document.getElementById('ads-input');
const haloInput = document.getElementById('halo-input');
const dailyResetToggle = document.getElementById('daily-reset-toggle');
const timerInput = document.getElementById('timer-input');
const resetHourInput = document.getElementById('reset-hour-input');
const historyButton = document.getElementById('history-btn');

function loadState() {
    chrome.storage.local.get(['ads_totalTasks', 'halo_totalTasks', 'dailyResetEnabled', 'taskTimeSeconds', 'resetHour'], res => {
        adsInput.value = res.ads_totalTasks || 0;
        haloInput.value = res.halo_totalTasks || 0;
        dailyResetToggle.checked = res.dailyResetEnabled !== false;
        timerInput.value = res.taskTimeSeconds || 90;
        resetHourInput.value = res.resetHour != null ? res.resetHour : 0;
    });
}

function getLocalDateStr(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function getTodayDateStr(resetHour) {
    var now = new Date();
    var hour = now.getHours();
    if (hour < resetHour) {
        var d = new Date(now);
        d.setDate(d.getDate() - 1);
        return getLocalDateStr(d);
    }
    return getLocalDateStr(now);
}

function updateTodayEntry() {
    chrome.storage.local.get(['ads_totalTasks', 'halo_totalTasks', 'taskTimeSeconds', 'resetHour', 'todayEntry'], function(res) {
        var resetHr = res.resetHour != null ? res.resetHour : 0;
        var timeSec = res.taskTimeSeconds || 90;
        var dateStr = getTodayDateStr(resetHr);
        var adsTasks = res.ads_totalTasks || 0;
        var haloTasks = res.halo_totalTasks || 0;

        var entry = {
            date: dateStr,
            hour: String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0'),
            adsTasks: adsTasks,
            adsTime: adsTasks * timeSec,
            haloTasks: haloTasks,
            haloTime: haloTasks * timeSec
        };

        chrome.storage.local.set({ todayEntry: entry });
    });
}

function saveTasks() {
    chrome.storage.local.set({
        ads_totalTasks: parseInt(adsInput.value, 10) || 0,
        halo_totalTasks: parseInt(haloInput.value, 10) || 0
    }, updateTodayEntry);
}

adsInput.addEventListener('change', saveTasks);
haloInput.addEventListener('change', saveTasks);
adsInput.addEventListener('input', saveTasks);
haloInput.addEventListener('input', saveTasks);

dailyResetToggle.addEventListener('change', () => {
    chrome.storage.local.set({ dailyResetEnabled: dailyResetToggle.checked });
});

timerInput.addEventListener('input', () => {
    const val = parseInt(timerInput.value, 10);
    if (val && val >= 5) {
        chrome.storage.local.set({ taskTimeSeconds: val });
    }
});

resetHourInput.addEventListener('input', () => {
    const val = parseInt(resetHourInput.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 23) {
        chrome.storage.local.set({ resetHour: val });
    }
});

historyButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
});

loadState();
