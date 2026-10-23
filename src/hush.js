// Hush for Gmail: theme hook + split inbox tab bar.
(() => {
  const root = document.documentElement;
  root.classList.add("hush");

  const splits = (typeof HUSH_SPLITS !== "undefined" ? HUSH_SPLITS : []).map((s) => ({
    ...s,
    query: `in:inbox {${s.terms.join(" ")}}`,
  }));

  // "Inbox" = inbox minus every split; "All" = Gmail's plain inbox.
  const restQuery = ["in:inbox", ...splits.flatMap((s) => s.terms.map((t) => `-${t}`))].join(" ");
  const tabs = [
    { id: "rest", label: "Inbox", query: restQuery, color: typeof HUSH_INBOX_COLOR !== "undefined" ? HUSH_INBOX_COLOR : undefined },
    ...splits,
    { id: "all", label: "All", hash: "#inbox", color: typeof HUSH_ALL_COLOR !== "undefined" ? HUSH_ALL_COLOR : undefined },
  ];

  const norm = (q) => q.replace(/\s+/g, " ").trim().toLowerCase();
  const hashFor = (tab) =>
    tab.hash || "#search/" + encodeURIComponent(tab.query).replace(/%20/g, "+");

  // Returns { tab, reading } for the current URL, or null when outside the inbox / splits.
  function currentView() {
    const parts = location.hash.slice(1).split("/");
    if (parts[0] === "inbox") {
      return { tab: tabs.find((t) => t.id === "all"), reading: parts.length > 1 };
    }
    if (parts[0] === "search" && parts[1]) {
      const q = norm(decodeURIComponent(parts[1].replace(/\+/g, " ")));
      const tab = tabs.find((t) => t.query && norm(t.query) === q);
      if (tab) return { tab, reading: parts.length > 2 };
      const old = staleTab(q);
      if (old) return { tab: old, reading: parts.length > 2, stale: true };
    }
    return null;
  }

  // A tab URL from before splits.config.js was edited (bookmark, history, open window).
  // Recognize it by shape so it can be upgraded to the tab's current query.
  function staleTab(q) {
    if (q.startsWith("in:inbox -")) return tabs.find((t) => t.id === "rest");
    const inner = q.match(/^in:inbox \{(.*)\}$/)?.[1];
    if (!inner) return null;
    return splits.find((s) => s.terms.some((t) => inner.includes(norm(t)))) || null;
  }

  let bar, indicator;
  function buildBar() {
    bar = document.createElement("nav");
    bar.id = "hush-splits";
    bar.setAttribute("role", "tablist");
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hush-tab";
      btn.dataset.id = tab.id;
      btn.setAttribute("role", "tab");
      const label = document.createElement("span");
      label.textContent = tab.label;
      const count = document.createElement("span");
      count.className = "hush-count";
      if (tab.color) count.style.color = tab.color;
      btn.append(label, count);
      btn.addEventListener("click", () => {
        location.hash = hashFor(tab);
      });
      bar.append(btn);
    }
    indicator = document.createElement("span");
    indicator.className = "hush-indicator";
    bar.append(indicator);
    renderCounts();
  }

  // ---------- Tab counts ----------
  // Read from the page: whenever a tab's list is on screen, record how many emails it holds
  // (Gmail's "1–N of M" total when present, else the visible rows). Counts for other tabs are
  // as fresh as your last visit, and persist across reloads.
  const account = location.pathname.match(/\/mail\/u\/\d+/)?.[0] ?? "/mail/u/0";
  const storeKey = `hush:counts:${account}`;
  let counts = {};
  try {
    counts = JSON.parse(localStorage.getItem(storeKey)) || {};
  } catch {
    counts = {};
  }

  function measure() {
    const view = currentView();
    const main = visibleMain();
    if (!view || view.reading || !main) return;
    const rows = [...main.querySelectorAll("tr.zA")].filter((r) => r.offsetParent !== null).length;
    const range = main.querySelector(".Dj")?.textContent || "";
    const total = range.match(/\bof\s+([\d,.]+)/)?.[1]?.replace(/[,.]/g, "");
    const value = total ? total : rows >= 50 ? `${rows}+` : String(rows);
    // Zero rows alone could just mean "still loading"; Gmail's empty-state message confirms it.
    const emptyMsg = [...main.querySelectorAll(".TB .TC")].some((e) => e.textContent.trim());
    const empty = rows === 0 && (emptyMsg || (view.tab.id === "all" && root.classList.contains("inboxZero")));
    updateZero(view, main, empty);
    if (counts[view.tab.id] === value) return;
    counts[view.tab.id] = value;
    try {
      localStorage.setItem(storeKey, JSON.stringify(counts));
    } catch {
      // Storage blocked: counts just won't survive a reload.
    }
    renderCounts();
  }

  // ---------- Inbox zero streak ----------
  // A week (ISO, Monday–Sunday) counts once the Inbox tab (or All) is emptied at least once.
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

  let zeroEl = null;
  function updateZero(view, main, empty) {
    if (empty && (view.tab.id === "rest" || view.tab.id === "all")) recordZero();
    // "All" keeps Simplify's own inbox-zero screen; splits get ours in place of Gmail's message.
    if (!empty || view.tab.id === "all") {
      zeroEl?.remove();
      return;
    }
    const { n, thisWeek } = streak();
    const title = view.tab.id === "rest" ? "Inbox zero" : "All clear";
    let line;
    if (n === 0) line = "Clear your Inbox to start a streak";
    else if (thisWeek) line = n === 1 ? "week of inbox zero" : "weeks in a row of inbox zero";
    else line = `week streak · clear your Inbox this week to keep it`;
    const key = `${view.tab.id}|${n}|${thisWeek}`;
    if (zeroEl?.dataset.key === key && zeroEl.parentElement === main) return;
    zeroEl?.remove();
    zeroEl = document.createElement("div");
    zeroEl.id = "hush-zero";
    zeroEl.dataset.key = key;
    const titleEl = document.createElement("div");
    titleEl.className = "hush-zero-title";
    titleEl.textContent = title;
    const lineEl = document.createElement("div");
    lineEl.className = "hush-zero-line";
    if (n > 0) {
      const num = document.createElement("span");
      num.className = "hush-zero-num";
      num.textContent = String(n);
      if (view.tab.color) num.style.color = view.tab.color;
      lineEl.append(num, " ");
    }
    lineEl.append(line);
    zeroEl.append(titleEl, lineEl);
    (bar?.parentElement === main ? bar : main.firstChild)?.after(zeroEl);
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

  function renderCounts() {
    if (!bar) return;
    for (const btn of bar.querySelectorAll(".hush-tab")) {
      const n = counts[btn.dataset.id];
      btn.querySelector(".hush-count").textContent = n && n !== "0" ? n : "";
    }
    schedule(); // tab widths may have changed; re-place the underline
  }

  // The underline is one element that slides between tabs. Gmail moves the bar between view
  // containers mid-switch, which kills a running transition, so a re-parent shortly after a
  // move replays the slide from where it started.
  let indicatorAt = null;
  let slideFrom = null;
  let slideStart = 0;
  const SLIDE_MS = 260;

  function setIndicator(pos, animate) {
    indicator.style.transition = animate ? "" : "none";
    indicator.style.transform = `translateX(${pos.x}px)`;
    indicator.style.width = `${pos.w}px`;
    indicator.style.backgroundColor = pos.color || "";
  }

  function placeIndicator(btn, reparented) {
    if (!btn.offsetWidth) return;
    const color = tabs.find((t) => t.id === btn.dataset.id)?.color;
    const to = { x: btn.offsetLeft + 12, w: btn.offsetWidth - 24, color };
    const moved = !indicatorAt || to.x !== indicatorAt.x || to.w !== indicatorAt.w;
    const replay = reparented && performance.now() - slideStart < SLIDE_MS;
    if (!moved && !replay) return;
    if (moved) {
      slideFrom = indicatorAt;
      slideStart = performance.now();
    }
    if (slideFrom) {
      setIndicator(slideFrom, false);
      void indicator.offsetWidth; // commit the start position before transitioning
    }
    setIndicator(to, !!slideFrom);
    indicatorAt = to;
  }

  // Briefly flag the page after a tab change so freshly rendered rows animate in.
  let lastTabId = null;
  let animateTimer;
  function flagTabChange() {
    root.classList.add("hush-animate");
    clearTimeout(animateTimer);
    animateTimer = setTimeout(() => root.classList.remove("hush-animate"), 1200);
  }

  function visibleMain() {
    for (const el of document.querySelectorAll('div[role="main"]')) {
      if (el.offsetParent !== null) return el;
    }
    return null;
  }

  function sync() {
    const view = currentView();
    root.classList.toggle("hush-in-split", !!view && view.tab.id !== "all");
    if (!view || view.reading) {
      bar?.remove();
      zeroEl?.remove();
      return;
    }
    if (view.stale) {
      location.replace(location.href.split("#")[0] + hashFor(view.tab));
      return;
    }
    if (lastTabId && view.tab.id !== lastTabId) flagTabChange();
    lastTabId = view.tab.id;
    if (!bar) buildBar();
    let active;
    for (const btn of bar.querySelectorAll(".hush-tab")) {
      const selected = btn.dataset.id === view.tab.id;
      btn.setAttribute("aria-selected", String(selected));
      if (selected) active = btn;
    }
    const main = visibleMain();
    const reparented = !!main && bar.parentElement !== main;
    if (reparented) main.prepend(bar);
    if (bar.isConnected) placeIndicator(active, reparented);
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

  window.addEventListener("hashchange", schedule);
  const start = () => {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
