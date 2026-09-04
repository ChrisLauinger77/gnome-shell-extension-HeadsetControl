#!/bin/bash
# Script to pack, install, or upload the HeadsetControl GNOME Shell extension
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
script_path="$script_dir/$(basename -- "${BASH_SOURCE[0]}")"
cd "$script_dir" || exit 1

extension="HeadsetControl@lauinger-clan.de"
extensionfile="$extension.shell-extension.zip"
metadata_file="$extension/metadata.json"

# Keep version normalization identical between this helper and the Git hooks.
source "$script_dir/.githooks/version-utils.sh"

echo "Running $0 for $extension with arguments: $@"

read_metadata_version() {
  jq -er '.["version-name"] | strings' "$metadata_file"
}

read_package_version() {
  jq -er '.version | strings' package.json
}

check_version() {
  local metadata_version package_version normalized_metadata_version

  if ! metadata_version=$(read_metadata_version); then
    echo "ERROR: Unable to read version-name from $metadata_file" >&2
    return 2
  fi
  if ! package_version=$(read_package_version); then
    echo "ERROR: Unable to read version from package.json" >&2
    return 2
  fi
  if ! normalized_metadata_version=$(normalize_version "$metadata_version"); then
    echo "ERROR: Invalid metadata.json version-name: $metadata_version" >&2
    return 2
  fi

  echo "metadata.json version-name: $metadata_version"
  echo "package.json version:       $package_version"
  if [[ "$package_version" != "$normalized_metadata_version" ]]; then
    echo "ERROR: Version mismatch" >&2
    echo "Expected package.json version: $normalized_metadata_version" >&2
    return 1
  fi

  echo "Version check OK."
}

update_version() {
  local metadata_version package_version normalized_metadata_version

  if ! metadata_version=$(read_metadata_version); then
    echo "ERROR: Unable to read version-name from $metadata_file" >&2
    return 2
  fi
  if ! package_version=$(read_package_version); then
    echo "ERROR: Unable to read version from package.json" >&2
    return 2
  fi
  if ! normalized_metadata_version=$(normalize_version "$metadata_version"); then
    echo "ERROR: Invalid metadata.json version-name: $metadata_version" >&2
    return 2
  fi

  echo "metadata.json version-name: $metadata_version"
  if [[ "$package_version" == "$normalized_metadata_version" ]]; then
    echo "package.json version:       $package_version"
    echo "Version already up to date."
    return 0
  fi

  echo "Current package version:    $package_version"
  echo "Updating package version to $normalized_metadata_version ..."
  npm pkg set "version=$normalized_metadata_version" || return
  echo "Updating package-lock.json ..."
  npm install --package-lock-only || return
  echo "Version update complete."
}

case "${1:-}" in
  install-dependencies)
    npm ci
    ;;
  cleanup)
    if [[ -f "$extensionfile" ]]; then
      rm -- "$extensionfile"
      echo "Removed generated archive: $extensionfile"
    else
      echo "No generated archive to remove: $extensionfile"
    fi
    ;;
  check-version)
    check_version
    ;;
  update-version)
    update_version
    ;;
  setup-hooks)
    if git config --local core.hooksPath .githooks; then
      echo "Git hooks enabled using .githooks"
    else
      exit $?
    fi
    ;;
  zip|pack)
    "$script_path" cleanup
    cd "$extension"
    gnome-extensions pack --podir=../po/ --out-dir=../ --extra-source=./ui/ --extra-source=../LICENSE --force
    cd ..
    echo "Extension zip created ..."
    ;;
  install)
    if [[ ! -f "$extensionfile" ]]; then
      "$script_path" zip
    fi
    gnome-extensions install "$extensionfile" --force
    gnome-extensions enable "$extension"
    echo "Extension zip installed ..."
    ;;
  upload)
    if [[ ! -f "$extensionfile" ]]; then
      "$script_path" zip
    fi
    gnome-extensions upload --accept-tos --user ChrisLauinger77 --password-file /var/data/dev/ego_password "$extensionfile"
    ;;
  translate)
    reffile=HeadsetControl.pot
    xgettext --from-code=UTF-8 --output=po/"$reffile" "$extension"/*.js "$extension"/schemas/*.xml "$extension"/ui/*.ui
    cd po
    for pofile in *.po
      do
        echo "Updating: $pofile"
        msgmerge --backup=off -N -U "$pofile" "$reffile"
        msgattrib --no-obsolete -o "$pofile" "$pofile"
      done
    echo "Done."
    ;;
  *)
    echo "Usage: $0 {install-dependencies|zip|pack|install|translate|upload|cleanup|check-version|update-version|setup-hooks}"
    exit 1
    ;;
esac
