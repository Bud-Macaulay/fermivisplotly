#!/usr/bin/env bash
set -euo pipefail

### Usage: ./generate_testrange.sh <input.bxsf> <output_dir> ###
### ./generate_testrange.sh -h (shows this message) ###

# -------- defaults --------
PRECISIONS=(1 2 3 4)
RESOLUTIONS=(8 16 24 32 48 64 128)
ENERGY_MIN=-0.05
ENERGY_MAX=0.05

# -------- args --------
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input.bxsf> <output_dir>"
  exit 1
fi

INPUT_BXSF="$1"
OUTDIR="$2"

# -------- checks --------
if [ ! -f "$INPUT_BXSF" ]; then
  echo "Error: input file does not exist: $INPUT_BXSF"
  exit 1
fi

mkdir -p "$OUTDIR"

# -------- run --------
for p in "${PRECISIONS[@]}"; do
  for r in "${RESOLUTIONS[@]}"; do
    OUTFILE="${OUTDIR}/$(basename "$INPUT_BXSF" .bxsf)_p${p}_r${r}.json"

    echo "→ p=$p r=$r → $(basename "$OUTFILE")"

    convert-bxsf "$INPUT_BXSF" \
      -e "$ENERGY_MIN" "$ENERGY_MAX" \
      -r "$r" \
      -p "$p" \
      -o "$OUTFILE"

    # -------- compress --------
    gzip -kf "$OUTFILE"          # creates OUTFILE.json.gz
    brotli -kf "$OUTFILE"        # creates OUTFILE.json.br
  done
done

# -------- generate index.json --------
INDEX_FILE="${OUTDIR}/testinfo.json"

echo "Generating testinfo.json"

{
  echo "["
  first=true
  for f in "$OUTDIR"/*.json; do
    [ "$(basename "$f")" = "testinfo.json" ] && continue
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi
    # capture file sizes
    size=$(stat -c%s "$f") # bytes
    gzip_size=$(stat -c%s "$f.gz" || echo 0)
    br_size=$(stat -c%s "$f.br" || echo 0)

    printf '  {"file":"%s","size":%s,"gzip":%s,"brotli":%s}' \
      "$(basename "$f")" "$size" "$gzip_size" "$br_size"
  done
  echo
  echo "]"
} > "$INDEX_FILE"

echo "✓ Done"
