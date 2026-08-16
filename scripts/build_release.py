#!/usr/bin/env python3
"""Create the self-contained HTML5 ZIP uploaded to game portals."""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIRS = ("css", "js")
ENTRY_FILE = ROOT / "index.html"
REFERENCE_RE = re.compile(r"(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)


def runtime_files() -> list[Path]:
    files = [ENTRY_FILE]
    for directory in RUNTIME_DIRS:
        files.extend(path for path in (ROOT / directory).rglob("*") if path.is_file())
    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def validate() -> None:
    if not ENTRY_FILE.is_file():
        raise RuntimeError("index.html is missing")

    html = ENTRY_FILE.read_text(encoding="utf-8")
    for reference in REFERENCE_RE.findall(html):
        if reference.startswith(("#", "data:")):
            continue
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or reference.startswith("//"):
            raise RuntimeError(
                f"External runtime reference found in index.html: {reference}\n"
                "Portal builds must be self-contained."
            )
        target = ROOT / parsed.path
        if not target.is_file():
            raise RuntimeError(f"Referenced file is missing: {parsed.path}")


def build(output: Path) -> tuple[int, int]:
    validate()
    files = runtime_files()
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in files:
            archive.write(source, source.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(output) as archive:
        names = archive.namelist()
        if "index.html" not in names:
            raise RuntimeError("Release archive does not contain index.html at its root")
        archive.testzip()

    return len(files), output.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "release" / "wave-arena.zip",
        help="ZIP output path (default: release/wave-arena.zip)",
    )
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output

    try:
        count, size = build(output)
    except (OSError, RuntimeError, zipfile.BadZipFile) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        return 1

    print(f"Built {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")
    print(f"Files: {count} | ZIP size: {size / 1024:.1f} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
