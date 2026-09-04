normalize_version() {
  local version=${1:-}

  if [[ "$version" =~ ^([0-9]+)(\.([0-9]+))?(\.([0-9]+))?$ ]]; then
    printf '%s.%s.%s\n' \
      "${BASH_REMATCH[1]}" \
      "${BASH_REMATCH[3]:-0}" \
      "${BASH_REMATCH[5]:-0}"
    return 0
  fi

  return 2
}
