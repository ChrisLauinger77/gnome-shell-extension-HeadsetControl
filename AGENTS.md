# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

This repository contains the GNOME Shell extension `HeadsetControl@lauinger-clan.de`.
It visualizes and controls headset state by calling the external
[`headsetcontrol`](https://github.com/Sapd/HeadsetControl) command-line tool.

The `shell-version` entries in `HeadsetControl@lauinger-clan.de/metadata.json`,
which holds the public extension metadata, declare the GNOME Shell versions
supported by the current extension release only.

The GNOME Shell compatibility badge in `README.md` is broader: it shows every
GNOME Shell major version supported across all HeadsetControl releases. It
currently spans GNOME 42 through 51 inclusive. When updating the badge, include
GNOME versions supported by older extension releases, even if they are no longer
in the current release's `shell-version` list.

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
- `headsetcontrol.sh`: helper script for packaging, installing, uploading,
  refreshing translations, and keeping versions in sync.
- `.githooks/`: optional Git hooks that check or sync the `package.json`
  version against `metadata.json`.
- `eslint.config.js`: ESLint flat config for GJS/GNOME Shell globals.
- `.github/workflows/eslint.yml`: CI version consistency check, ESLint scan,
  and Shexli scan.
- `.github/workflows/release.yml`: release packaging and EGO upload workflow.

## Useful Commands

Run from the repository root unless noted otherwise.

```bash
./headsetcontrol.sh install-dependencies
npm run lint
./headsetcontrol.sh zip
./headsetcontrol.sh install
./headsetcontrol.sh translate
./headsetcontrol.sh check-version
./headsetcontrol.sh update-version
./headsetcontrol.sh setup-hooks
./headsetcontrol.sh cleanup
```

Run `./headsetcontrol.sh install-dependencies` after pulling or rebasing remote
changes that modify `package-lock.json`, particularly Renovate updates.

Notes:

- `npm run lint` is the main automated local check.
- `./headsetcontrol.sh zip` calls `gnome-extensions pack` and writes
  `HeadsetControl@lauinger-clan.de.shell-extension.zip` in the repository root.
- `./headsetcontrol.sh install` builds the zip if needed, installs it with
  `gnome-extensions install --force`, and enables the extension.
- `./headsetcontrol.sh translate` updates `po/HeadsetControl.pot` and merges
  existing `po/*.po` files. Run it after changing translatable strings.
- `./headsetcontrol.sh check-version` verifies that the `package.json` version
  matches `version-name` in `metadata.json` (normalized to `x.y.z`).
  `update-version` updates `package.json` and `package-lock.json` to match.
  CI runs `check-version`, and the pre-commit hook enabled by `setup-hooks`
  blocks commits with mismatched staged versions. Requires `jq`.
- `./headsetcontrol.sh cleanup` removes the generated extension zip.
- `./headsetcontrol.sh upload` uploads to extensions.gnome.org with the
  maintainer's local credentials. Do not run it from an agent.
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
- In JSON mode, menu actions run with the JSON output option and append
  `-d <vid:pid>` when headsetcontrol supports device selection. Failed actions
  show a notification in both JSON and legacy mode.
- The Quick Settings menu is rebuilt when relevant capabilities, command
  options, or configurable menu values change.
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

## Validation Checklist

Before finishing changes, run the validations that match the edit:

- JavaScript changes: `npm run lint`.
- Capability detection, output parsing, or command-building changes: exercise
  the affected JSON and legacy output paths with a real or simulated
  `headsetcontrol` executable, or explain if local execution is not available.
- Schema, metadata, packaging, icon, UI, or translation changes:
  `./headsetcontrol.sh zip`.
- User-visible strings: `./headsetcontrol.sh translate`.
- Runtime behavior: load the extension in GNOME Shell and check the Quick
  Settings controls, system indicator, and preferences window.
- Submission-oriented changes: use `$review-gnome-shell-extension` to check
  lifecycle cleanup, process boundaries, metadata, schemas, subprocesses,
  privacy, maintainability, and packaging requirements.

If a required GNOME, headset, or gettext command is unavailable in the
environment, state that clearly in the final response.

## Packaging And Release

- Release builds are produced by `./headsetcontrol.sh zip`.
- Bump `version-name` in `metadata.json` and run
  `./headsetcontrol.sh update-version` so `package.json` stays in sync.
- GitHub releases run on `v*` tags, build the extension zip, create a GitHub
  release, and upload to extensions.gnome.org using repository secrets. A
  manual `workflow_dispatch` run builds the zip as an artifact and uploads to
  EGO only when requested.
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
- The Test Mode preference (`test-mode` key) appends `--test-device <n>` to
  every headsetcontrol call so its built-in test device profiles can be used
  without a headset. It is reset to off when the extension is enabled.
- The default executable path is `/usr/local/bin/headsetcontrol`, configurable in
  preferences.

## Agent-Specific Cautions

- Do not assume a headset or GNOME Shell session is available in the coding
  environment. Prefer linting and packaging checks when runtime testing is not
  possible.
- Use `$review-gnome-shell-extension` when changing runtime, preferences,
  metadata, schema, packaging, or user-data behavior that may affect
  extensions.gnome.org review.
- Preserve translation files unless a string/schema/UI change requires updating
  them.
- Keep generated release artifacts out of commits.
- This repo may have user changes in progress. Check `git status --short` before
  editing and do not revert unrelated work.
