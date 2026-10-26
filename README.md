# Hush for Gmail

A quiet, Superhuman-style dark theme and split inbox for Gmail, built as a Firefox/Zen extension that
layers on top of [Simplify Gmail](https://simpl.fyi).

Built after cancelling Superhuman, to keep its calm look and split inbox without the subscription.
No Superhuman shortcuts or other features. Just the look, the splits, hover shortcuts, and the
inbox zero streak.

## What it does

- **Dark, minimal theme.** Near-black palette, system font, compact 44px rows, no row borders.
  Sender, subject and date read by brightness and weight. Unread rows keep Simplify's blue dot.
  Checkboxes and unstarred stars only show on hover. Importance markers are hidden and label chips are muted.
- **Split inbox tabs**: **Inbox · Docs · Calendar · Alerts · All**
  - **Docs**: Google Drive/Docs/Sheets/Slides shares and comments
  - **Calendar**: `.ics` invites, Google Calendar notifications, accept/decline replies
  - **Alerts**: Honeybadger (`honeybadger.io`)
  - **Inbox**: everything in the inbox that isn't in a split
  - **All**: Gmail's plain inbox
  - Each tab has its own underline color. The underline slides between tabs and rows fade in on switch.
- **Per-tab email counts** next to each tab label.
- **Account label.** The tab bar shows the account's email address, so work and personal tabs are easy to tell apart.
- **Hover shortcuts.** Gmail's action keys (`e`, `#`, `s`, `Shift+I`, `l`, …) act on the email under the
  mouse, without ticking its checkbox first. Archived and deleted rows vanish at once.
- **Inbox zero streak.** An empty split shows how many weeks in a row you've hit inbox zero.
  Seeded with the 89-week streak carried over from Superhuman.

## How it works

| File | Role |
|---|---|
| `src/manifest.json` | Firefox MV3 manifest. Content script on `mail.google.com`, `update_url` for self-hosted auto-updates |
| `src/splits.config.js` | **The file you edit**: tabs, their search terms, colors, streak seed |
| `src/hush.js` | Tab bar, sliding underline, counts, streak |
| `src/hush.css` | Theme |
| `src/icon.svg` | Add-on icon: the split tab bar over quiet rows, in the theme's colors |
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
- **Splits are Gmail searches.** Each tab navigates to `#search/<query>`. A split's terms are OR'ed:
  `in:inbox {term1 term2}`. "Inbox" is `in:inbox -term1 -term2 …` across all splits. This needs no API,
  no OAuth, and no data leaves the browser. The tab bar is injected into the visible `div[role="main"]`
  and re-attached by a `MutationObserver`, because Gmail re-renders views constantly.
- **Search-page clutter is hidden on split tabs only** (the `html.hush-in-split` class). That covers Gmail's
  filter chips (`.G6`/`.biW`), the single-sender contact card (`.bX`), the "No messages matched your
  search" banner (`.TB .TC`), the redundant "Inbox" label chip, and the long query in the search box.
- **Stale tab URLs self-heal.** Editing `splits.config.js` changes a tab's query, so old URLs from
  bookmarks or open windows wouldn't match. `staleTab()` recognizes the old shape and redirects to the
  current query.
- **Counts are read from the page**, not an API. When a tab is open, Hush records Gmail's "1–N of M"
  total, or else the visible row count. Counts are cached in `localStorage` per machine. They're only as
  fresh as your last visit to that tab, and can show `50+` for big tabs. (The Gmail API would give live
  counts, but needs a Google Cloud OAuth client. We deliberately skipped that.)
- **Hover shortcuts tick, then replay.** Gmail only applies shortcuts to checked rows or its j/k cursor.
  Hush swallows the key, ticks the hovered row, waits for Gmail to mark it selected (`.x7`), then
  replays the key. Removing actions hide the row immediately (`.hush-gone`, remembered by thread id so Gmail's redraws stay hidden) and run one at a time so
  queued rows never share a selection. A manual selection, an open email, or j/k turns this off.
- **Inbox zero streak.** An ISO week (Mon–Sun) counts once the **Inbox** tab (or All) is genuinely empty.
  Gmail's empty-state message must be present, so a loading list doesn't count. The current week doesn't
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
"All" isn't limited to Primary.

## Updates (automatic)

The manifest's `update_url` points at `updates.json` in this repo. Zen checks it about once a day and
installs newer versions from GitHub Releases on its own. To check right away: `about:addons` → gear →
**Check for Updates**. Settings, counts and the streak carry over.

## Making changes

```sh
# try changes live (temporary add-on, gone after restart):
#   about:debugging → This Zen → Load Temporary Add-on → src/manifest.json
#   then "Reload" there + refresh Gmail after each edit
./build.sh               # lint + package dist/hush.xpi
./release.sh 1.0.2       # bump version, build, commit, tag, push, GitHub Release
                         # (add a "## 1.0.2" section to CHANGELOG.md first; it becomes the notes)
```

Requires Node (for `npx web-ext`) and the GitHub CLI (`gh auth login`) for releasing.

Common edits, all in `src/splits.config.js`:

- **Add a sender to a split**: add a search term, e.g. `"from:sentry.io"` under Alerts
- **New tab**: add an entry with `id`, `label`, `color`, `terms`
- **Colors**: each split's `color`, plus `HUSH_INBOX_COLOR` / `HUSH_ALL_COLOR`

Search operators: <https://support.google.com/mail/answer/7190>.

## Known limitations

- Gmail's class names are obfuscated and can change. If something breaks after a Gmail update, it's
  almost always a selector in `hush.css`.
- Counts for tabs you haven't opened recently are stale.
- The "Not starred" hover rule matches Gmail's English UI label.
- Emails in splits are still in Gmail's inbox, so Gmail's own unread badge counts them. Don't use a Gmail
  "Skip the Inbox" filter for split senders, because tabs only show inbox mail.

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
