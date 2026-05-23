# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

This repository contains the GNOME Shell extension `HeadsetControl@lauinger-clan.de`.
It visualizes and controls headset state by calling the external
[`headsetcontrol`](https://github.com/Sapd/HeadsetControl) command-line tool.

The extension targets GNOME Shell 48, 49, and 50. The public extension metadata
lives in `HeadsetControl@lauinger-clan.de/metadata.json`.

## Important Files

- `HeadsetControl@lauinger-clan.de/extension.js`: GNOME Shell extension runtime.
  It creates the Quick Settings toggle and system indicator, invokes
  `headsetcontrol`, parses JSON and legacy output, refreshes capabilities, and
  sends low-battery notifications.
- `HeadsetControl@lauinger-clan.de/prefs.js`: preferences window logic using
  Gtk/Adwaita APIs and `Gtk.Builder`.
- `HeadsetControl@lauinger-clan.de/ui/prefs.ui`: preferences UI definition.
- `HeadsetControl@lauinger-clan.de/schemas/org.gnome.shell.extensions.HeadsetControl.gschema.xml`:
  GSettings schema and defaults.
- `po/*.po` and `po/HeadsetControl.pot`: gettext translation files.
- `headsetcontrol.sh`: helper script for packaging, installing, uploading, and
  refreshing translations.
- `eslint.config.js`: ESLint 9 flat config for GJS/GNOME Shell globals.
- `.github/workflows/eslint.yml`: CI lint scan.
- `.github/workflows/release.yml`: release packaging and EGO upload workflow.

## Development Commands

Run from the repository root unless noted otherwise.

```bash
npm install
npm run lint
./headsetcontrol.sh zip
./headsetcontrol.sh install
./headsetcontrol.sh translate
```

Notes:

- `npm run lint` is the main automated local check.
- `./headsetcontrol.sh zip` calls `gnome-extensions pack` and writes
  `HeadsetControl@lauinger-clan.de.shell-extension.zip` in the repository root.
- `./headsetcontrol.sh install` builds the zip if needed, installs it with
  `gnome-extensions install --force`, and enables the extension.
- `./headsetcontrol.sh translate` updates `po/HeadsetControl.pot` and merges
  existing `po/*.po` files. Run it after changing translatable strings.
- There is currently no real test suite. `npm test` intentionally exits with an
  error.

## Code Style

- Use ES modules and modern GJS imports, matching the existing files.
- Keep JavaScript indentation at 4 spaces. Other files default to 2 spaces via
  `.editorconfig`.
- Use `const` by default and `let` only when reassignment is needed.
- Keep user-visible strings wrapped in `_()` so gettext can extract them.
- Prefer `console.*` or the extension logger helpers over GNOME's old `log()` /
  `logError()` globals. ESLint forbids the old globals.
- Avoid adding dependencies unless there is a clear repository-level reason.

## Runtime Architecture Notes

- `enable()` initializes settings, creates `HeadsetControlIndicator`, builds
  command strings from GSettings, probes capabilities, starts the refresh timer,
  and connects settings plus Quick Settings signals.
- `disable()` must disconnect signals, remove GLib timeout sources, destroy the
  indicator, and clear references. Be careful with lifecycle changes here.
- `capabilities` and `headsetcontrolCommands` are module-level mutable objects.
  Changes to capability handling can affect both JSON and legacy output paths.
- JSON output via the configured `option-output-format` is preferred. If JSON
  parsing or invocation fails, the extension falls back to legacy capability,
  battery, and ChatMix commands.
- The Quick Settings menu is rebuilt when relevant capabilities or configurable
  menu values change.
- The system indicator label is only useful when battery capability is present.

## Settings And UI Changes

When adding or changing a setting, update all relevant places:

1. Add or modify the key in
   `HeadsetControl@lauinger-clan.de/schemas/org.gnome.shell.extensions.HeadsetControl.gschema.xml`.
2. Wire the setting in `extension.js` if it affects runtime behavior.
3. Wire the setting in `prefs.js` and `ui/prefs.ui` if it should be configurable.
4. Include any user-visible labels/descriptions in gettext extraction by running
   `./headsetcontrol.sh translate`.

Be careful that GSettings key names in `extension.js`, `prefs.js`, and the schema
match exactly.

## Packaging And Release

- Release builds are produced by `./headsetcontrol.sh zip`.
- GitHub releases run on `v*` tags, build the extension zip, create a GitHub
  release, and upload to extensions.gnome.org using repository secrets.
- Do not commit generated `.zip`, `.mo`, `*.po~`, or
  `schemas/gschemas.compiled` files. They are ignored.

## Manual Testing Tips

- After installing, restart GNOME Shell as appropriate for the session type.
- Enable logging in the extension preferences, then watch logs with:

```bash
journalctl -f -o cat
```

- A real or simulated `headsetcontrol` executable is needed to fully exercise
  capability detection, battery state, ChatMix, equalizer, and notification
  behavior.
- The default executable path is `/usr/local/bin/headsetcontrol`, configurable in
  preferences.

## Agent-Specific Cautions

- Do not assume a headset or GNOME Shell session is available in the coding
  environment. Prefer linting and packaging checks when runtime testing is not
  possible.
- Preserve translation files unless a string/schema/UI change requires updating
  them.
- Keep generated release artifacts out of commits.
- This repo may have user changes in progress. Check `git status --short` before
  editing and do not revert unrelated work.
