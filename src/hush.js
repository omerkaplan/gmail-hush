// Hush for Gmail: a quiet theme hook, plus a slim header (account, inbox zero streak, health)
// and hover shortcuts on the inbox list.
(() => {
  const root = document.documentElement;
  root.classList.add("hush");

  // An add-on reload or update starts a fresh copy without reloading Gmail, and the old copy's
  // elements stay behind. Clear them so there's only ever one header.
  for (const el of document.querySelectorAll("#hush-header, #hush-splits, #hush-zero, #hush-bg")) el.remove();
  for (const el of document.querySelectorAll(".hush-gone")) el.classList.remove("hush-gone");
  root.classList.remove("hush-in-split", "hush-animate");

  const account = location.pathname.match(/\/mail\/u\/\d+/)?.[0] ?? "/mail/u/0";

  // The inbox list (#inbox, or no hash at all), as opposed to an open email or another view.
  const hashParts = () => location.hash.slice(1).split("/").filter(Boolean);
  const inInbox = () => {
    const parts = hashParts();
    return parts.length === 0 || (parts.length === 1 && parts[0] === "inbox");
  };
  // An open email: the last part of the hash is Gmail's message id (#inbox/FMfcgz…).
  const isReading = () => {
    const parts = hashParts();
    return parts.length > 1 && /^[A-Za-z0-9]{16,}$/.test(parts[parts.length - 1]);
  };

  function visibleMain() {
    for (const el of document.querySelectorAll('div[role="main"]')) {
      if (el.offsetParent !== null) return el;
    }
    return null;
  }

  // ---------- Header ----------
  let header, accountEl, healthEl, streakEl;
  function buildHeader() {
    header = document.createElement("div");
    header.id = "hush-header";
    accountEl = document.createElement("span");
    accountEl.className = "hush-account";
    healthEl = document.createElement("span");
    healthEl.className = "hush-health";
    streakEl = document.createElement("span");
    streakEl.className = "hush-streak";
    header.append(accountEl, healthEl, streakEl);
  }

  // Reads the inbox list on screen: how many rows, and whether Gmail says it's empty.
  function readList() {
    const main = visibleMain();
    if (!main) return null;
    const rows = [...main.querySelectorAll("tr.zA")].filter((r) => r.offsetParent !== null).length;
    // Zero rows alone could just mean "still loading"; an empty-state message confirms it.
    const emptyMsg =
      [...main.querySelectorAll(".TB .TC")].some((e) => e.textContent.trim()) || root.classList.contains("inboxZero");
    return { main, rows, emptyMsg };
  }

  function measure() {
    if (!inInbox()) return;
    const list = readList();
    if (!list) return;
    if (list.rows === 0 && list.emptyMsg) recordZero();
    renderStreak();
    checkHealth(list);
  }

  // Gmail fills lists in bursts and rarely goes fully quiet, so throttle rather than debounce:
  // any change after a measurement schedules another, so the settled state always gets counted.
  let measureTimer = null;
  const measureSoon = () => {
    if (measureTimer) return;
    measureTimer = setTimeout(() => {
      measureTimer = null;
      measure();
    }, 700);
  };

  // ---------- Inbox zero streak ----------
  // A week (ISO, Monday–Sunday) counts once the inbox is emptied at least once.
  // The current week only breaks the streak once it's over.
  // Weeks are a set, so copies from different machines merge by union: localStorage is the fast
  // local copy, browser.storage.sync carries it to other machines via Firefox/Zen Sync.
  const zeroKey = `hush:zero:${account}`;
  let zeroWeeks = [];
  try {
    zeroWeeks = JSON.parse(localStorage.getItem(zeroKey)) || [];
  } catch {
    zeroWeeks = [];
  }
  if (typeof HUSH_STREAK_SEED !== "undefined") {
    const d = new Date(`${HUSH_STREAK_SEED.through}T12:00`);
    for (let i = 0; i < HUSH_STREAK_SEED.weeks; i++) {
      zeroWeeks.push(weekKey(d));
      d.setDate(d.getDate() - 7);
    }
    zeroWeeks = [...new Set(zeroWeeks)];
  }

  function weekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Thursday decides the ISO year
    const year = d.getUTCFullYear();
    const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  function streak() {
    const weeks = new Set(zeroWeeks);
    const d = new Date();
    const thisWeek = weeks.has(weekKey(d));
    if (!thisWeek) d.setDate(d.getDate() - 7);
    let n = 0;
    while (weeks.has(weekKey(d))) {
      n++;
      d.setDate(d.getDate() - 7);
    }
    return { n, thisWeek };
  }

  function recordZero() {
    const key = weekKey(new Date());
    if (zeroWeeks.includes(key)) return;
    zeroWeeks = [...zeroWeeks, key];
    saveWeeks();
  }

  const syncArea = globalThis.browser?.storage?.sync;
  function saveWeeks() {
    try {
      localStorage.setItem(zeroKey, JSON.stringify(zeroWeeks));
    } catch {
      // Storage blocked: the synced copy still has it.
    }
    syncArea?.set({ [zeroKey]: zeroWeeks }).catch(() => {});
  }
  function mergeWeeks(more) {
    const merged = [...new Set([...zeroWeeks, ...(more || [])])];
    const grew = merged.length > zeroWeeks.length;
    zeroWeeks = merged;
    return grew;
  }
  syncArea
    ?.get(zeroKey)
    .then((stored) => {
      mergeWeeks(stored[zeroKey]);
      saveWeeks(); // push anything only this machine had
      schedule();
    })
    .catch(() => {});
  globalThis.browser?.storage?.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[zeroKey] && mergeWeeks(changes[zeroKey].newValue)) {
      try {
        localStorage.setItem(zeroKey, JSON.stringify(zeroWeeks));
      } catch {
        // Storage blocked: in-memory copy is enough for this session.
      }
      schedule();
    }
  });

  function renderStreak() {
    if (!streakEl) return;
    const { n } = streak();
    const text = n > 0 ? `${n}-week streak` : "";
    if (streakEl.textContent !== text) streakEl.textContent = text;
    streakEl.title = n > 0 ? "Weeks in a row you've reached inbox zero" : "";
  }

  // ---------- Account ----------
  // Which account this tab is, for telling work and personal Gmail tabs apart. Gmail puts the
  // address in the page title ("Inbox (3) - you@example.com - Gmail"), with the account
  // button's label ("Google Account: Name (you@example.com)") as a fallback.
  const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
  function accountEmail() {
    return (
      document.title.match(EMAIL)?.[0] ||
      document.querySelector('[aria-label^="Google Account"]')?.getAttribute("aria-label").match(EMAIL)?.[0] ||
      ""
    );
  }
  // HUSH_ACCOUNT_COLORS (hush.config.js) maps a full address or "@domain" to the label's color.
  const accountColors = typeof HUSH_ACCOUNT_COLORS !== "undefined" ? HUSH_ACCOUNT_COLORS : {};
  function accountColor(email) {
    const lower = email.toLowerCase();
    const at = lower.indexOf("@");
    return accountColors[lower] || (at >= 0 && accountColors[lower.slice(at)]) || "";
  }
  function renderAccount() {
    const email = accountEmail();
    if (!accountEl || accountEl.textContent === email) return;
    accountEl.textContent = email;
    accountEl.title = email;
    accountEl.style.color = accountColor(email);
  }

  // ---------- Health check ----------
  // Hush leans on Gmail's internal class names, which Gmail can rename at any time. A check
  // that keeps failing for HEALTH_GRACE_MS (so not just a page still loading) shows a small
  // warning in the header naming what stopped working; hover it for the full list.
  const HEALTH_GRACE_MS = 8000;
  const failingSince = {};
  function checkHealth(list) {
    const row = list.main.querySelector("tr.zA");
    const checks = {
      "Simplify Gmail isn't active": !root.classList.contains("simplify"),
      "Can't find email rows (inbox zero streak may miss a week)": !row && !list.emptyMsg,
      "Can't find row checkboxes (hover shortcuts are off)": !!row && !rowCheckbox(row),
      "Can't identify threads (archived emails may flicker back)": !!row && !threadId(row),
      "Can't find the account address": !accountEmail(),
    };
    const now = performance.now();
    const problems = [];
    for (const [problem, failing] of Object.entries(checks)) {
      if (!failing) delete failingSince[problem];
      else if (now - (failingSince[problem] ??= now) >= HEALTH_GRACE_MS) problems.push(problem);
    }
    const text = problems.length ? `⚠ ${problems[0]}${problems.length > 1 ? ` +${problems.length - 1}` : ""}` : "";
    if (healthEl.textContent !== text) healthEl.textContent = text;
    healthEl.title = problems.length ? `Hush: Gmail may have changed.\n\n${problems.join("\n")}` : "";
  }

  function sync() {
    if (!inInbox()) {
      header?.remove();
      return;
    }
    if (!header) buildHeader();
    renderAccount();
    const main = visibleMain();
    if (main && header.parentElement !== main) main.prepend(header);
    measureSoon();
  }

  // Gmail re-renders views constantly; re-check at most once per frame.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };

  // ---------- Hover shortcuts ----------
  // Gmail's action shortcuts apply to checked rows, or else to its j/k cursor row. Pressing one
  // while hovering a row (with nothing checked) ticks that row's checkbox first, so the key acts
  // on the email under the mouse. Keys that leave the row in place get it unticked afterwards.
  // Keys that open a menu (label, move, snooze) keep it ticked until the menu is done.
  const HOVER_KEYS = {
    e: "removes", "#": "removes", y: "removes", "!": "removes", m: "removes",
    s: "stays", I: "stays", U: "stays", "+": "stays", "=": "stays", "-": "stays",
    l: "menu", v: "menu", b: "menu",
  };
  // The row under the mouse, found from the last pointer position so it stays right when rows
  // vanish or shift underneath a still mouse. j/k hands control back to Gmail's own cursor
  // until the mouse moves again.
  let pointer = null;
  document.addEventListener("mousemove", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
  }, true);
  document.addEventListener("mouseleave", () => {
    pointer = null;
  });
  const hoveredRow = () =>
    pointer && document.elementFromPoint(pointer.x, pointer.y)?.closest("tr.zA:not(.hush-gone)");

  const rowCheckbox = (row) =>
    row.querySelector('.oZ-x3 [role="checkbox"]') || row.querySelector('[role="checkbox"]');
  const isTicked = (row) => rowCheckbox(row)?.getAttribute("aria-checked") === "true";
  function clickBox(box) {
    for (const type of ["mousedown", "mouseup", "click"]) {
      box.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  // Gmail picks up a ticked checkbox asynchronously, so the original key would find nothing
  // selected. Hold it back, tick the row, then replay the key once Gmail has caught up.
  function replayKey(target, e) {
    const init = {
      key: e.key, code: e.code, keyCode: e.keyCode, which: e.which, shiftKey: e.shiftKey,
      bubbles: true, cancelable: true, view: window,
    };
    target.dispatchEvent(new KeyboardEvent("keydown", init));
    target.dispatchEvent(new KeyboardEvent("keypress", {
      ...init, keyCode: 0, charCode: e.key.charCodeAt(0), which: e.key.charCodeAt(0),
    }));
    target.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  // Resolves once check() is true (re-checked on every class change of the row), or after ms.
  function waitFor(row, check, ms) {
    return new Promise((resolve) => {
      if (check()) return resolve();
      const finish = () => {
        watcher.disconnect();
        clearTimeout(timer);
        resolve();
      };
      const watcher = new MutationObserver(() => check() && finish());
      watcher.observe(row.parentElement || row, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      const timer = setTimeout(finish, ms);
    });
  }

  // Hidden rows are remembered by thread, because Gmail often redraws the list (archive in
  // particular) before its server catches up, bringing the email back as a fresh row.
  // Re-hidden from the MutationObserver, which runs before the redraw is painted. If Gmail
  // still shows the thread after GONE_MS (the action failed), it comes back.
  const GONE_MS = 8000;
  const gone = new Map(); // thread id -> time hidden
  const threadId = (row) =>
    row.querySelector("[data-thread-id]")?.getAttribute("data-thread-id") ||
    row.querySelector("[data-legacy-thread-id]")?.getAttribute("data-legacy-thread-id");
  function hideRow(row) {
    row.classList.add("hush-gone");
    const id = threadId(row);
    if (id) gone.set(id, performance.now());
    else setTimeout(() => row.classList.remove("hush-gone"), GONE_MS);
  }
  function hideGone() {
    if (!gone.size) return;
    const now = performance.now();
    for (const row of document.querySelectorAll("tr.zA")) {
      const id = threadId(row);
      if (!id || !gone.has(id)) continue;
      row.classList.toggle("hush-gone", now - gone.get(id) < GONE_MS);
    }
    for (const [id, at] of gone) if (now - at >= GONE_MS) gone.delete(id);
  }
  setInterval(hideGone, 2000); // unhides expired threads even if the page goes quiet

  // Actions run one at a time, so a queued row is never ticked alongside one still in flight.
  const pending = new Set();
  let queue = Promise.resolve();
  async function act(row, kind, target, e) {
    clickBox(rowCheckbox(row));
    await waitFor(row, () => row.classList.contains("x7"), 1000);
    replayKey(target.isConnected ? target : document.body, e);
    if (kind === "removes") {
      await waitFor(row, () => !row.isConnected || !row.classList.contains("x7"), 1500);
    } else if (kind === "stays") {
      await new Promise((r) => setTimeout(r, 300));
      if (row.isConnected && isTicked(row)) clickBox(rowCheckbox(row));
    }
    pending.delete(row);
  }

  window.addEventListener("keydown", (e) => {
    if (!e.isTrusted) return; // our own replay
    if (e.key === "j" || e.key === "k") pointer = null;
    const kind = HOVER_KEYS[e.key];
    if (!kind || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (isReading()) return; // an open email is already the target
    const row = hoveredRow();
    const main = visibleMain();
    if (!row || !main?.contains(row) || !rowCheckbox(row) || pending.has(row)) return;
    // Respect a manual selection; rows ticked by a queued or hidden action don't count.
    const manual = (r) => isTicked(r) && !pending.has(r) && !r.classList.contains("hush-gone");
    if ([...main.querySelectorAll("tr.zA")].some(manual)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Swallow the matching keypress too, so Gmail never sees the original key.
    window.addEventListener("keypress", (p) => {
      if (p.isTrusted) {
        p.preventDefault();
        p.stopImmediatePropagation();
      }
    }, { capture: true, once: true });
    // Rows that are about to leave the list go immediately; Gmail catches up in the background.
    if (kind === "removes") hideRow(row);
    pending.add(row);
    const target = e.target;
    queue = queue.then(() => act(row, kind, target, e)).catch(() => pending.delete(row));
  }, true);

  window.addEventListener("hashchange", schedule);
  setInterval(schedule, 15000); // keeps the streak and health check current while the page is quiet
  const start = () => {
    new MutationObserver(() => {
      hideGone();
      schedule();
    }).observe(document.body, { childList: true, subtree: true });
    schedule();
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
