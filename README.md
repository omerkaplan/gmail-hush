# Hush for Gmail

A quiet, Superhuman-style dark theme and hover shortcuts for Gmail, built as a Firefox/Zen extension
that layers on top of [Simplify Gmail](https://simpl.fyi).

Built after cancelling Superhuman, to keep its calm look without the subscription. Just the look,
hover shortcuts, an account label, and the inbox zero streak, all on Gmail's plain inbox.

## What it does

- **Dark, minimal theme.** Near-black palette, system font, compact 44px rows, no row borders.
  Sender, subject and date read by brightness and weight. Unread rows keep Simplify's blue dot.
  Checkboxes and unstarred stars only show on hover. Importance markers are hidden and label chips are muted.
- **Header** above the inbox list:
  - **Account label**: the account's email address, colored per account, so work and personal Gmail
    tabs are easy to tell apart.
  - **Inbox zero streak**: how many weeks in a row you've hit inbox zero. Seeded with the 89-week
    streak carried over from Superhuman.
  - **Health warning**: an amber note if something Hush relies on stops matching Gmail (see below).
- **Hover shortcuts.** Gmail's action keys (`e`, `#`, `s`, `Shift+I`, `l`, …) act on the email under the
  mouse, without ticking its checkbox first. Archived and deleted rows vanish at once.

## How it works

| File | Role |
|---|---|
| `src/manifest.json` | Firefox MV3 manifest. Content script on `mail.google.com`, `update_url` for self-hosted auto-updates |
| `src/hush.config.js` | **The file you edit**: account label colors, streak seed |
| `src/hush.js` | Header (account, streak, health check), hover shortcuts |
| `src/hush.css` | Theme |
| `src/icon.svg` | Add-on icon: colored underlines over quiet rows, in the theme's colors |
| `build.sh` | Lint and package as `dist/hush.xpi` |
| `release.sh` | Publish a new version so every installed copy auto-updates |
| `CHANGELOG.md` | What changed in each version; `release.sh` copies a version's section to its GitHub Release |
| `updates.json` | Firefox update manifest that installed copies poll (written by `release.sh`) |

Key design decisions:

- **Layer on Simplify, don't fight Gmail.** Simplify already cleans Gmail up and drives its look through
  CSS variables on `html.simplify` (with `.darkTheme` for dark mode). `hush.css` overrides those variables
  with `!important`, then styles Gmail's long-stable row classes (`.zA` row, `.zE` unread, `.yW` sender,
  `.bog` subject, `.y2` snippet, `.xW` date, `.a4W` subject cell). Hush expects Simplify to be installed
  and Gmail's theme set to **Dark**.
- **Plain inbox only.** Hush used to add split tabs (Docs, Calendar, Alerts) built from Gmail searches.
  They were dropped in 1.1.0: Gmail ranks search results its own way, and counting tabs you aren't
  looking at would need the Gmail API (a Google Cloud OAuth app, with weekly re-sign-in for personal
  Gmail) or a hidden Gmail frame, which Gmail refuses when sandboxed and which can disturb the real tab
  when not. Everything Hush does now works on the inbox Gmail already shows, in Gmail's own order.
- **The header** is injected into the visible `div[role="main"]` on the inbox list and re-attached by a
  `MutationObserver`, because Gmail re-renders views constantly.
- **Account label.** The address comes from the page title ("Inbox (3) - you@example.com - Gmail"), with
  the account button's label as a fallback. `HUSH_ACCOUNT_COLORS` matches a full address or `@domain`.
- **Health check.** Hush relies on Gmail's internal class names. If one keeps failing for 8 seconds
  (Simplify inactive, rows, checkboxes, thread ids, account address), the header shows a warning naming
  what stopped working. Hover it for the full list.
- **Hover shortcuts tick, then replay.** Gmail only applies shortcuts to checked rows or its j/k cursor.
  Hush swallows the key, ticks the hovered row, waits for Gmail to mark it selected (`.x7`), then
  replays the key. Removing actions hide the row immediately (`.hush-gone`, remembered by thread id so Gmail's redraws stay hidden) and run one at a time so
  queued rows never share a selection. A manual selection, an open email, or j/k turns this off.
- **Inbox zero streak.** An ISO week (Mon–Sun) counts once the inbox is genuinely empty. Gmail's (or
  Simplify's) empty state must be present, so a loading list doesn't count. The current week doesn't
  break the streak until it's over. Weeks are stored as a set in `localStorage` and in
  `browser.storage.sync`, merged by union, so both Macs share one streak via Zen/Firefox Sync.
  `HUSH_STREAK_SEED` in the config adds the pre-Hush streak.

## Install (each Mac, once)

Zen is built without Mozilla's add-on signing requirement (`MOZ_REQUIRE_SIGNING: false`), so an unsigned
add-on stays installed once you allow it:

1. Install [Simplify Gmail](https://addons.mozilla.org/firefox/addon/simplify-gmail/) and set Gmail's theme
   to **Dark** (Gmail → Quick settings → Theme).
2. `about:config` → `xpinstall.signatures.required` → `false`
3. Download `hush-<version>.xpi` from the latest
   [GitHub Release](../../releases/latest), then `about:addons` → gear → **Install Add-on From File…**
   (or drag the file onto a Zen window). Accept the permission prompt: Gmail access to run Hush, storage for streak sync.
   If Hush ever stops styling Gmail, check `about:addons` → Hush → **Permissions** and turn on
   access to `mail.google.com` (it can drop after testing a temporary copy).
4. For a shared streak: sign both Zens into the same Mozilla account with **Add-ons** sync enabled.

Recommended Gmail settings: Settings → Inbox → Inbox type **Default** with category tabs unchecked, so
the inbox (and the streak) covers all mail, not just Primary. Quick settings → Density **Comfortable**
shows a paperclip instead of attachment chips, keeping every row one line.

## Updates (automatic)

The manifest's `update_url` points at `updates.json` in this repo. Zen checks it about once a day and
installs newer versions from GitHub Releases on its own. To check right away: `about:addons` → gear →
**Check for Updates**. The streak carries over.

## Making changes

```sh
# try changes live (temporary add-on, gone after restart):
#   about:debugging → This Zen → Load Temporary Add-on → src/manifest.json
#   then "Reload" there + refresh Gmail after each edit
./build.sh               # lint + package dist/hush.xpi
./release.sh 1.1.1       # bump version, build, commit, tag, push, GitHub Release
                         # (add a "## 1.1.1" section to CHANGELOG.md first; it becomes the notes)
```

Requires Node (for `npx web-ext`) and the GitHub CLI (`gh auth login`) for releasing.

Common edits, in `src/hush.config.js`:

- **Account colors**: `HUSH_ACCOUNT_COLORS`, e.g. `"@example.com": "#4ea8ff"`
- **Streak seed**: `HUSH_STREAK_SEED`

## Known limitations

- Gmail's class names are obfuscated and can change. If something breaks after a Gmail update, it's
  almost always a selector in `hush.css`.
- The "Not starred" hover rule expects Gmail's English UI.
- Hover shortcuts have a short delay for star and mark read/unread, because Gmail registers the
  selection before applying them.

## History

Built over one session in October 2026, iterating from screenshots:

1. Theme on top of Simplify, plus the split tab bar.
2. Hid Gmail's search filter chips that floated over the tabs.
3. Hid the contact card and "no messages" banner on split tabs.
4. Sliding underline and row fade-in animations.
5. Removed row borders.
6. Per-tab underline colors.
7. Fixed the subject column sitting lower than sender/date (forced cells to center).
8. Unread counts (Atom feed), then replaced with total counts read from the page.
9. Starred emails keep their star visible.
10. Alerts tab for Honeybadger. Self-healing stale tab URLs.
11. Inbox zero streak, seeded at 89 weeks from Superhuman.
12. Permanent install, synced streak, GitHub auto-updates.
13. Hover shortcuts and square row highlights.
14. Account label, newest-first split tabs, health warning; a hidden-Gmail attempt at live tab counts.
15. Simplified to the plain inbox (1.1.0): split tabs, counts and re-sorting removed.
