#!/bin/bash

# Output file for flattened project
OUTPUT_FILE="${1:-flattened_project.txt}"

# Check if this is a Git repository
if [ ! -d .git ]; then
  echo "Error: This doesn't seem to be a Git repository (no .git directory found)."
  exit 1
fi

# Clear output file
> "$OUTPUT_FILE"

# Counters for summary
INCLUDED_COUNT=0
EXCLUDED_COUNT=0

# Image extensions to exclude
IMAGE_EXTENSIONS="\.png$|\.jpg$|\.jpeg$|\.gif$|\.bmp$|\.webp$|\.ico$|\.svg$"

# Function to check if a file is ignored by .gitignore
is_ignored() {
  local path="$1"
  path="${path#./}"
  git check-ignore -q "$path" 2>/dev/null && return 0
  local parent="$path"
  while [ "$parent" != "." ] && [ "$parent" != "/" ]; do
    parent=$(dirname "$parent")
    git check-ignore -q "$parent" 2>/dev/null && return 0
  done
  return 1
}

# Function to check if a file is text-based
is_text_file() {
  local file="$1"
  local ext="${file##*.}"
  case "$ext" in
    ts|tsx|js|jsx|css|json|html|md|txt|sh|yml|yaml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Find and process files
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | while read -r file; do
  # Skip output file, lock files, and Firebase cache
  if [ "$file" = "./$OUTPUT_FILE" ] ||
     [[ "$file" == *"/bun.lockb" ]] ||
     [[ "$file" == *"/package-lock.json" ]] ||
     [[ "$file" == *"/.firebase/"* ]]; then
    ((EXCLUDED_COUNT++))
    continue
  fi

  # Skip image files
  if echo "$file" | grep -E -q "$IMAGE_EXTENSIONS"; then
    ((EXCLUDED_COUNT++))
    continue
  fi

  # Skip ignored files
  if is_ignored "$file"; then
    ((EXCLUDED_COUNT++))
    continue
  fi

  # Include text-based files
  if is_text_file "$file"; then
    echo "=== $file ===" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo -e "\n" >> "$OUTPUT_FILE"
    ((INCLUDED_COUNT++))
  else
    ((EXCLUDED_COUNT++))
  fi
done

# Print summary
echo "Flattened project written to: $OUTPUT_FILE"
echo "Summary: Included $INCLUDED_COUNT files, excluded $EXCLUDED_COUNT files"