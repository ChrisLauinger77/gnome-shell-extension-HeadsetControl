# GNOME Extension Review Checklist

Source: https://gjs.guide/extensions/review-guidelines/review-guidelines.html

Use this checklist when changing code that will ship to
extensions.gnome.org. It summarizes the GNOME Shell Extensions Review
Guidelines for repository work; consult the source page when review-sensitive
details may have changed.

## Lifecycle

- Do not create GObjects, widgets, signal connections, main loop sources, or
  Shell modifications during module import, `constructor()`, or other
  initialization paths.
- Create runtime objects, connect signals, add timers, and modify GNOME Shell
  from `enable()`.
- Undo everything from `enable()` in `disable()`: destroy widgets and objects,
  disconnect signals, remove main loop sources, clear dynamic module-level
  state, and restore any overridden Shell behavior.
- Remove every GLib source in `disable()`, even callbacks that normally return
  `false` or `GLib.SOURCE_REMOVE`.

## Imports And Process Boundaries

- Do not import deprecated modules such as `ByteArray`, `Lang`, or `Mainloop`.
- Do not import `Gdk`, `Gtk`, or `Adw` in the GNOME Shell process
  (`extension.js`).
- Do not import `Clutter`, `Meta`, `St`, or `Shell` in the preferences process
  (`prefs.js`).
- Keep preferences code and Shell runtime code separated so their libraries do
  not conflict.

## Reviewability

- Keep JavaScript readable, consistently formatted, and reviewable.
- Do not ship minified, obfuscated, or poorly formatted generated code.
- TypeScript, if used, must be transpiled to readable JavaScript.
- Avoid excessive logging; logs should be limited to important messages and
  errors.
- Do not include comments or large inconsistent blocks that look like
  unexplained generated output. Be prepared to explain submitted code.

## Objects, Signals, And GObject Disposal

- Destroy all extension-created objects and widgets in `disable()`.
- Store signal handler IDs and disconnect them in `disable()`.
- Avoid `GObject.Object.run_dispose()`. If it is truly required, add a comment
  explaining the concrete reason.

## Extension System And Subprocesses

- Avoid modifying, reloading, or interacting with other extensions or the
  extension system unless the extension purpose requires it.
- External scripts and binaries are strongly discouraged.
- Do not include binary executables or libraries.
- Spawn subprocesses carefully and make sure they exit cleanly.
- Prefer GJS for scripts. Other languages need a strong functional reason and
  compatible licensing.
- Installing dependencies through `pip`, `npm`, `yarn`, or similar tools must
  require explicit user action.
- Avoid privileged subprocesses. If unavoidable, use `pkexec` and never execute
  a user-writable file with elevated privileges.

## Privacy And User Data

- Do not use telemetry tools or share user data online.
- Any clipboard access must be declared in the extension description.
- Do not share clipboard data with a third party without explicit user action.
- Do not ship default keyboard shortcuts that interact with clipboard data.

## Metadata

- Keep `metadata.json` well formed and limited to useful keys.
- `uuid` must follow the `extension-id@namespace` form and must not use
  `gnome.org` as the namespace.
- `shell-version` must list only stable releases and at most one development
  release. Do not claim support for future GNOME Shell versions.
- Drop `session-modes` when only `user` mode is used.
- Use only valid donation keys and omit `donations` when unused.
- Include a useful project URL where users can report issues or learn more.

## Session Modes

- Use `unlock-dialog` only when it is required for correct operation.
- Disconnect keyboard-event signals in `unlock-dialog` mode.
- Add a `disable()` comment explaining why `unlock-dialog` is needed.
- Do not selectively disable only parts of the extension.

## GSettings Schemas

- Schema IDs should use `org.gnome.shell.extensions` as their base.
- Schema paths should use `/org/gnome/shell/extensions` as their base.
- Include schema XML files in the extension ZIP.
- Name schema files as `<schema-id>.gschema.xml`.

## Legal And Distribution

- GNOME-hosted extension content must comply with the GNOME Code of Conduct.
- Do not promote national or international political agendas.
- Distribute the extension under terms compatible with GNOME Shell's
  `GPL-2.0-or-later` license.
- Attribute copied code from other extensions in distributed files.
- Do not include copyrighted or trademarked content without permission.

## Packaging And Recommendations

- Do not include unnecessary files in submission ZIPs, such as build scripts,
  install scripts, `.po` or `.pot` files, unused media, or unrelated assets.
- Run a linter before submission.
- Prefer GNOME Human Interface Guidelines for preferences UI.
