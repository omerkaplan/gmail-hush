# Changelog

Each version's section is also its GitHub Release notes (`release.sh` copies it over).

## 1.0.4 (2026-10-23)

- Gmail access is now granted at install. Before, the browser could leave Hush without access to
  `mail.google.com` (e.g. after testing a temporary copy), and Gmail showed plain Simplify.
  Updating asks once to approve the permission.

## 1.0.3 (2026-10-23)

- Add-on icon: the split tab bar over quiet rows, in the theme's colors.

## 1.0.2 (2026-10-23)

- **Hover shortcuts.** Gmail's action keys (`e`, `#`, `y`, `!`, `m`, `s`, `Shift+I`, `Shift+U`, `+`, `-`,
  `l`, `v`, `b`) act on the email under the mouse, without ticking its checkbox first.
  Archived and deleted rows vanish at once and stay hidden through Gmail's redraws.
- Square row highlights instead of Simplify's rounded ones.
- Simplify's blue dot is now the only unread marker (Hush's purple dot is gone).
- Reloading or updating the add-on no longer leaves a second tab bar behind.

## 1.0.1 (2026-10-22)

First published version.

- Dark, minimal theme on top of Simplify Gmail.
- Split inbox tabs (Inbox · Docs · Calendar · Alerts · All) with sliding, per-tab colored underlines.
- Per-tab email counts.
- Inbox zero streak, synced between Macs, seeded at 89 weeks from Superhuman.
- Self-hosted auto-updates from GitHub Releases.
