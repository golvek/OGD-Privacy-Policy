# AGENTS.md - Ogden (Watcher)

## Project Overview

Chrome Extension (Manifest V3) that injects a floating HUD into Facebook's internal code review tool (`review.intern.facebook.com`). Watcher-only: reads the DOM to track tasks and time, never modifies the page.

**All features free**. No license system. No premium tiers. Ko-fi logo in popup linking to `https://ko-fi.com/golvek#checkoutModal`.

Mode switches automatically by detecting DOM elements, or manually by clicking the mode label.

## File Map

```
manifest.json      - Extension manifest (permissions, content script registration, popup action)
content.js         - All logic: shared overlay, ADS mode, Halo mode, auto-detect, toggle, drag, daily reset, history snapshots
popup.html         - Extension popup: task count editing, timer config, daily reset toggle, Ko-fi logo, history button
popup.js           - Popup logic: task count saving, timer config, history page link
history.html       - Daily metrics page: today box with live updates, past days table (7-day paginated, expandable, 30-day max)
history.js         - History page logic: rendering, storage.onChanged, pagination, expand/collapse
about.html         - Feature overview page
```

## Loading the Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. "Load unpacked" -> select this directory (`C:/Users/Mateus/Desktop/ogden`)
4. No build step required (vanilla JS, no bundler)

## Architecture

`content.js` runs as a content script (`run_at: document_end`, `all_frames: true`) on all pages under `https://review.intern.facebook.com/intern/review/*`.

### Overlay Layout

Single horizontal row, minimal style:
```
ADS  5  03m 45s  01:23
```
`white-space: nowrap` prevents line breaks. No badge (all features free).

| Column | Color | Content |
|--------|-------|---------|
| Mode label | `#ffffff` | `ADS` or `HALO` (click to toggle manually) |
| Task count | `#81c784` (HALO) / `#64ffda` (ADS) | Total tasks for current mode |
| Accumulated time | `#b388ff` | `tasks x timerSeconds`, formatted `00m 00s` or `1h 00m 00s` |
| Countdown | `#ffffff` / `#ff4d4d` (<=10s) | Timer, `tabular-nums` for stable width |

### All Features (free, no gating)

- **Task counter**: Increments on Submit button click (ADS and HALO)
- **Countdown timer**: Default 90s, configurable via popup. Only ticks when a task is active.
- **ADS**: Submit click detection via capture-phase click listener on buttons. Debounced at 1s.
- **Halo**: Task change detection via `div._964` polling (500ms), resets countdown. Submit button detection matches ADS pattern: detects the submit div directly or a `<button>` ancestor containing it. `haloHasSubmittedTask` reset to `false` on `startHalo()` to avoid stale flags.
- **Mode auto-detect** (every 2s): Polls for ADS/HALO elements, switches if detected mode differs from active.
- **Mode toggle**: Click the mode label to switch manually.
- **Daily reset**: Both modes reset at a configurable hour (default 0 = midnight, 0-23). Toggleable via popup. Changing the reset hour immediately resets counters and finalizes the current day.
- **Drag**: Overlay is draggable; position persisted to `chrome.storage.local` and `localStorage`.
- **Configurable timer**: Set via popup, stored in `chrome.storage.local` key `taskTimeSeconds`. Min 5 seconds. Widget updates live via `storage.onChanged` (no messaging).
- **Daily history**: Real-time snapshots saved to `todayEntry` on task increment + every 15 countdown ticks. At daily reset, finalized into `dailyHistory`. History page shows today's stats live and past days paginated (7-day blocks, max 30 days back).

### What it does NOT do

No DOM modification. No auto-click. No clipboard access. No keyboard shortcuts. No auto-minimize. Pure watcher.

### Mode Switching

Two mechanisms:

1. **Auto-detect** (every 2s): Polls for `div.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft` with text "Ads Integrity" -> switches to ADS. Polls for `span._55pe` with text "Halo" -> switches to Halo. Only toggles if detected mode differs from active.

2. **Manual**: Click the `ADS`/`HALO` label (handles `mousedown`/`click` with `stopPropagation` to prevent drag interference).

On toggle: current mode's state is saved, intervals/event listeners for current mode are stopped, new mode's state is loaded from storage, intervals/listeners for new mode are started. Active mode stored in `chrome.storage.local` key `activeMode`.

### Interval Management

| Interval | Purpose | Started by | Stopped by |
|----------|---------|------------|------------|
| `countdownIntervalId` | 1s countdown tick + history snapshot every 15s | `startCountdown()` (init + toggle) | never |
| `haloPollIntervalId` | 500ms task change poll | `startHalo()` | `stopHalo()` |
| `dailyResetIntervalId` | 1-hour reset check | `init()` | never |
| `autoDetectIntervalId` | 2s mode auto-detect | `init()` via `startAutoDetect()` | never |

### Event Listener Lifecycle

- `adsClickHandler`: added on `startADS()` (capture-phase click), removed on `stopADS()`.
- `haloClickHandler`: added on `startHalo()` (capture-phase click), removed on `stopHalo()`.

### Widget Live Updates

`storage.onChanged` listener in `content.js` reacts to:
- `taskTimeSeconds` change -> reload timer, recalculate accumulated time, reset countdown, save snapshot
- `resetHour` change -> reload hour, finalize current day, zero both task counters, reset in-memory state
- `ads_totalTasks` / `halo_totalTasks` change -> reload mode state, save snapshot

No `chrome.tabs` messaging required. Popup writes to storage, widget picks it up instantly.

### ADS Mode

- **Submit Detection**: Capture-phase click listener on buttons. Walks up ancestors looking for inner div with classes `x6ikm8r x10wlt62 x2b8uid xlyipyv xuxw1ft` and text "submit" (case-insensitive). Or button text itself is "submit". Debounced at 1s. Increments task count and resets countdown.
- **Storage keys**: `ads_totalTasks`, `ads_countdown`, `ads_lastDate`, `ads_lastText`, `ads_countedCurrent`.

### Halo Mode

- **Task Change Detection**: Polls `div._964` every 500ms. When `currentTaskNumber` changes, resets countdown and re-renders.
- **Submit Detection**: Click handler matches ADS pattern: detects the submit div directly or a `<button>` ancestor containing it. `haloHasSubmittedTask` reset to `false` on `startHalo()` to avoid stale flags.
- **Storage keys**: `halo_totalTasks`, `halo_countdown`, `halo_hasSubmittedTask`, `halo_lastCurrentTaskNumber`, `halo_lastSubmitTime`, `halo_lastDate`.

### History System

- **`todayEntry`** (`chrome.storage.local`): Single object `{date, hour, adsTasks, adsTime, haloTasks, haloTime}`. Replaced on every snapshot (not appended). Written on task increment, every 15 countdown ticks, popup edits, and mode reload.
- **`dailyHistory`** (`chrome.storage.local`): Array of finalized day entries. Populated when `saveTodaySnapshot` detects a date change or `checkNewDay` triggers. Capped at 90 entries. Only 30 most-recent days are navigable in the UI.
- **`getTodayDateStr()`**: Returns the "review day" date based on the configurable `resetHour` (default 0 = midnight).

## History Page

- **Today box**: Side-by-side ADS (left)/HALO (right) columns with task count (large, colored) and time below. Total time at bottom.
- **Past days**: Hidden by default. "Expand" button reveals 7-day paginated table with `<`/`>` arrows. Max 30 days back.
- **Live updates**: `storage.onChanged` listener on `todayEntry` and `dailyHistory` updates the page in real time.
- **Layout**: 800px max-width, dark terminal style (#1e1e1e). HALO columns first, then ADS.
- **Column headers**: `Date | ADS tasks | ADS time | HALO tasks | HALO time`, colored by mode.

## Gotchas

- **`div._964` is fragile**: This generated CSS class is the backbone of Halo detection. If Facebook updates the UI, all detection silently breaks.
- **`all_frames: true`**: Content script injects into every iframe. ADS and Halo run independently in each frame. Can produce duplicate overlays and independent counters.
- **Two storage backends**: `chrome.storage.local` for task counts and mode state; `localStorage` for overlay drag position fallback. Different APIs, different scopes.
- **No error handling**: Storage operations lack `.catch()`. DOM queries have no fallbacks.
- **No tests, no build step**: Raw JS. Edit files directly.
- **Auto-detect polling runs on all pages**: The auto-detect interval keeps polling even on pages that don't contain ADS or Halo elements. Harmless but wasteful.
- **History page uses external script**: `history.js` loaded via `<script src>` (MV3-safe). CSP blocks inline scripts and external widget JS.
- **Ko-fi widget not supported**: MV3 CSP blocks external scripts. Uses static logo image with `<a>` link instead.

## UI

- **Popup** (`popup.html`): 260px dark terminal style (#1e1e1e). Two large number inputs (ADS teal #64ffda, HALO green #81c784), daily reset toggle, reset hour input (0-23), timer config, Ko-fi logo image, History button.
- **History page** (`history.html`): 800px max-width. Today box with HALO/ADS columns and total time. Expandable past days table with 7-day pagination.
- **About page** (`about.html`): Widget example, feature list, donation info.
- **Popup accent color**: `#b19cd9` (lavender purple) used for toggle, timer input, and history button.
- **Overlay task count color**: `#81c784` (HALO mode), `#64ffda` (ADS mode).

## Donations

- Ko-fi logo image linking to `https://ko-fi.com/C0C21S9LL6`
- Optional, no features gated
- Policy note: accepting donations from coworkers for a personal tool may violate Meta's internal side-project or ethics policies. Verify with your SRT lead.

## Code Conventions

- Plain functions, no modules or classes.
- Inline CSS via `style.cssText` template literals in `content.js`. External stylesheets in HTML pages.
- `setInterval` for all polling.
- `ads*` / `halo*` function prefixes for mode-specific logic.
- `typeof chrome !== 'undefined'` guards around all storage API calls.

## Permissions

- `storage`: For `chrome.storage.local` (task counts, mode state, overlay position, timer config, history).
- Host permission: `https://review.intern.facebook.com/*` (required for content script injection).
