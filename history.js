function formatTime(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
    return String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
}

var weekOffset = 0;
var allHistory = [];
var todayEntry = null;
var expanded = false;
var daysPerPage = 7;

function renderTodayBox(entry) {
    var container = document.getElementById('today-box');
    chrome.storage.local.get(['resetHour'], function (rhRes) {
        var resetHr = rhRes.resetHour != null ? rhRes.resetHour : 0;
        var now = new Date();
        var d = new Date();
        var h = now.getHours();
        if (h < resetHr) d.setDate(d.getDate() - 1);
        document.getElementById('subtitle').textContent = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (!entry || !entry.date) {
            container.innerHTML = '<div class="empty-today">No activity recorded yet today</div>';
            return;
        }

        var haloTime = entry.haloTime || 0;
        var adsTime = entry.adsTime || 0;
        var totalTime = haloTime + adsTime;

        container.innerHTML =
            '<div class="today-box">' +
                '<div class="today-cols">' +
                    '<div class="today-col">' +
                        '<div class="today-col-header ads-header">ADS</div>' +
                        '<div class="today-col-value ads-value">' + (entry.adsTasks || 0) + '</div>' +
                        '<div class="today-col-sub">' + formatTime(adsTime) + '</div>' +
                    '</div>' +
                    '<div class="today-col">' +
                        '<div class="today-col-header halo-header">HALO</div>' +
                        '<div class="today-col-value halo-value">' + (entry.haloTasks || 0) + '</div>' +
                        '<div class="today-col-sub">' + formatTime(haloTime) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="today-divider"></div>' +
                '<div class="today-total">' +
                    '<span class="label">Total</span>' +
                    '<span style="color:rgba(255,255,255,0.7)">' + formatTime(totalTime) + '</span>' +
                '</div>' +
            '</div>';
    });
}

function getPageSlice() {
    var maxDays = Math.min(allHistory.length, 30);
    var start = weekOffset * daysPerPage;
    return allHistory.slice(start, Math.min(start + daysPerPage, maxDays));
}

function getMonthKey(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getMonthLabel(monthKey) {
    var parts = monthKey.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long' });
}

function renderDaily() {
    var slice = getPageSlice();
    var tbody = document.getElementById('tbody');
    if (!slice || slice.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No data for this period</td></tr>';
    } else {
        var rows = '';
        slice.forEach(function (entry) {
            var d = new Date(entry.date + 'T12:00:00');
            var dateStr = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            rows += '<tr>' +
                '<td class="date">' + dateStr + '</td>' +
                '<td class="ads">' + (entry.adsTasks || 0) + '</td>' +
                '<td class="ads">' + formatTime(entry.adsTime || 0) + '</td>' +
                '<td class="halo">' + (entry.haloTasks || 0) + '</td>' +
                '<td class="halo">' + formatTime(entry.haloTime || 0) + '</td>' +
            '</tr>';
        });

        var monthKey = getMonthKey(slice[0].date);
        document.getElementById('month-label').textContent = getMonthLabel(monthKey);
        var sumAdsTasks = 0, sumAdsTime = 0, sumHaloTasks = 0, sumHaloTime = 0;
        var maxDays = Math.min(allHistory.length, 30);
        for (var i = 0; i < maxDays; i++) {
            if (getMonthKey(allHistory[i].date) !== monthKey) continue;
            sumAdsTasks += allHistory[i].adsTasks || 0;
            sumAdsTime += allHistory[i].adsTime || 0;
            sumHaloTasks += allHistory[i].haloTasks || 0;
            sumHaloTime += allHistory[i].haloTime || 0;
        }

        rows += '<tr class="totals-row">' +
            '<td colspan="5" style="font-weight:700;color:rgba(255,255,255,0.45);text-align:center;font-size:13px">Month total &middot; ' + formatTime(sumAdsTime + sumHaloTime) + '</td>' +
        '</tr>';
        tbody.innerHTML = rows;
    }
    updateNav();
}

function updateNav() {
    var maxDays = Math.min(allHistory.length, 30);
    var totalPages = Math.max(1, Math.ceil(maxDays / daysPerPage));
    document.getElementById('nav-range').textContent = 'week ' + (weekOffset + 1) + ' of ' + totalPages;
    document.getElementById('btn-prev').disabled = weekOffset <= 0;
    document.getElementById('btn-next').disabled = (weekOffset + 1) >= totalPages;
}

function setExpanded(value) {
    expanded = value;
    document.getElementById('past-table-container').style.display = expanded ? '' : 'none';
    document.getElementById('nav-row').style.display = expanded ? '' : 'none';
    document.getElementById('btn-expand').textContent = expanded ? 'Collapse' : 'Expand';
    if (expanded) {
        weekOffset = 0;
        renderDaily();
    }
}

function loadAll() {
    chrome.storage.local.get(['todayEntry', 'dailyHistory'], function (res) {
        todayEntry = res.todayEntry || null;
        renderTodayBox(todayEntry);
        allHistory = buildHistoryList(res.dailyHistory || [], todayEntry);
        weekOffset = 0;
        setExpanded(expanded);
    });
}

function buildHistoryList(dailyHistory, today) {
    var list = dailyHistory.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (today && today.date) {
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i].date === today.date) { idx = i; break; }
        }
        if (idx >= 0) {
            list[idx] = {
                date: today.date,
                adsTasks: today.adsTasks,
                adsTime: today.adsTime,
                haloTasks: today.haloTasks,
                haloTime: today.haloTime
            };
        } else {
            list.unshift({
                date: today.date,
                adsTasks: today.adsTasks,
                adsTime: today.adsTime,
                haloTasks: today.haloTasks,
                haloTime: today.haloTime
            });
        }
    }
    return list;
}

chrome.storage.onChanged.addListener(function (changes) {
    if (changes.todayEntry) {
        todayEntry = changes.todayEntry.newValue || null;
        renderTodayBox(todayEntry);
        chrome.storage.local.get(['dailyHistory'], function (res) {
            allHistory = buildHistoryList(res.dailyHistory || [], todayEntry);
            if (expanded) renderDaily();
        });
    }
    if (changes.dailyHistory) {
        allHistory = buildHistoryList(changes.dailyHistory.newValue || [], todayEntry);
        if (expanded) renderDaily();
    }
});

document.getElementById('btn-expand').addEventListener('click', function () {
    setExpanded(!expanded);
});

document.getElementById('btn-prev').addEventListener('click', function () {
    if (weekOffset > 0) {
        weekOffset--;
        renderDaily();
    }
});

document.getElementById('btn-next').addEventListener('click', function () {
    var maxDays = Math.min(allHistory.length, 30);
    var maxOffset = Math.ceil(maxDays / daysPerPage) - 1;
    if (weekOffset < maxOffset) {
        weekOffset++;
        renderDaily();
    }
});

loadAll();
