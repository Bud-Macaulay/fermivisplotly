#!/usr/bin/env bash
set -euo pipefail

# -------- defaults --------
PRECISIONS=(1 2 3 4 5)
RESOLUTIONS=(24 36 48 96 128)
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
  done
done

echo "✓ Done"
