#!/usr/bin/env python3
from pathlib import Path
import argparse

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--in", dest="inp", required=True)
  ap.add_argument("--out-prefix", dest="out_prefix", required=True)
  ap.add_argument("--lines", type=int, default=200)
  args = ap.parse_args()

  inp = Path(args.inp).resolve()
  out_prefix = args.out_prefix

  text = inp.read_text(encoding="utf-8").splitlines(True)
  if not text:
    raise SystemExit("empty input")

  n = args.lines
  parts = [text[i:i+n] for i in range(0, len(text), n)]

  for idx, chunk in enumerate(parts, start=1):
    out = Path(f"{out_prefix}_{idx:03d}.sql").resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(chunk), encoding="utf-8")

  print(f"OK: wrote {len(parts)} files")

if __name__ == "__main__":
  main()
