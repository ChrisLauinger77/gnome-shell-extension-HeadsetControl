#!/bin/bash
set -u -o pipefail

helper_name=${1:?helper name is required}
hook_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd) || exit 2
repo_root=$(git -C "$hook_dir/.." rev-parse --show-toplevel) || exit 2
cd "$repo_root" || exit 2

if "./$helper_name" check-version; then
  echo "Package version is consistent after the Git update."
  exit 0
else
  status=$?
fi

if [[ $status -ne 1 ]]; then
  echo "ERROR: Version check failed; automatic synchronization was not attempted." >&2
  exit "$status"
fi

echo "Version mismatch detected; synchronizing local package.json and package-lock.json ..."
"./$helper_name" update-version
