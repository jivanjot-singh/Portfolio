#!/usr/bin/env python3
"""
optimize.py - turn huge raw video files into fast-loading web files.

HOW TO USE
  1. Put your original exports in these folders (any size, any common format):
         raw/short/    short form edits (vertical 9:16 is fine)
         raw/long/     long form edits
         raw/colour/   colour correction edits
  2. Run:   python3 optimize.py        (Windows: python optimize.py)
  3. Upload the media/ folder to your video host (see README.md) and deploy the site.

WHAT IT DOES TO EACH FILE
  - Re-encodes to H.264 + AAC MP4, capped at 1080p, with a bitrate ceiling.
    This is where the big savings are: a 2 GB export typically becomes 20-150 MB.
  - Moves the MP4 "index" to the front of the file (+faststart) so the video starts
    playing before it has finished downloading.
  - Saves a poster image (JPG) so the page shows a picture instantly and downloads
    no video data until the visitor presses play.
  - Adds the video to data/videos.js (title, size, length). Existing titles and stars
    are never overwritten. Placeholder "sample" entries are removed automatically.

Needs: Python 3.8+ and ffmpeg (https://ffmpeg.org/download.html).
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
MEDIA = ROOT / "media"
DATA = ROOT / "data" / "videos.js"
CATEGORIES = ["short", "long", "colour"]
EXTS = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mts", ".m2ts", ".mpg", ".mpeg", ".wmv", ".mxf"}

HEADER = (
    "// Managed by optimize.py. You can edit titles, reorder entries, or set\n"
    '// "starred": true on ONE video per category (it then appears on the home page).\n'
    "// Keep it valid JSON. Entries marked \"sample\": true are placeholders and are\n"
    "// removed automatically the first time optimize.py processes a real video.\n"
)


def need(tool):
    path = shutil.which(tool)
    if not path:
        sys.exit(
            f"Could not find '{tool}'. Install ffmpeg first:\n"
            "  Windows: winget install ffmpeg   (or download from https://ffmpeg.org/download.html)\n"
            "  macOS:   brew install ffmpeg\n"
            "  Linux:   sudo apt install ffmpeg\n"
            "Then open a new terminal and run this script again."
        )
    return path


def mb(n):
    return f"{n / 1024 / 1024:.1f} MB" if n < 1024 ** 3 else f"{n / 1024 ** 3:.2f} GB"


def slugify(stem):
    s = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return s or "video"


def pretty_title(stem):
    t = re.sub(r"[_\-\s]+", " ", stem).strip()
    t = re.sub(r"^\d+\s+", "", t)  # drop "01 " style ordering prefixes
    return (t[:1].upper() + t[1:]) if t else "Untitled"


def probe(ffprobe, path):
    out = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        return None
    try:
        j = json.loads(out.stdout)
        st = j["streams"][0]
        return {"w": int(st["width"]), "h": int(st["height"]), "dur": float(j["format"].get("duration", 0))}
    except (KeyError, IndexError, ValueError):
        return None


def load_videos():
    if not DATA.exists():
        return []
    text = DATA.read_text(encoding="utf-8")
    try:
        start = text.index("[", text.index("window.VIDEOS"))
        return json.loads(text[start:text.rindex("]") + 1])
    except ValueError:
        sys.exit(f"{DATA} is not valid JSON (check for a missing comma or quote). Fix it, then run again.")


def save_videos(videos):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(HEADER + "window.VIDEOS = " + json.dumps(videos, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")


def encode(ffmpeg, src, out, height, crf, maxrate):
    scale = (f"scale=w='if(gt(iw,ih),-2,min({height},iw))':h='if(gt(iw,ih),min({height},ih),-2)':flags=lanczos,"
             "format=yuv420p")
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", scale,
        "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf),
        "-maxrate", maxrate, "-bufsize", str(int(float(maxrate[:-1]) * 2)) + maxrate[-1],
        "-c:a", "aac", "-b:a", "128k", "-ac", "2",
        "-movflags", "+faststart", "-map_metadata", "-1",
        str(out),
    ]
    return subprocess.run(cmd).returncode == 0


def poster(ffmpeg, video, out, info, at):
    t = min(at, max(info["dur"] / 3, 0))
    width = 720 if info["h"] > info["w"] else 960
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(video),
           "-frames:v", "1", "-vf", f"scale='min({width},iw)':-2", "-q:v", "4", str(out)]
    return subprocess.run(cmd).returncode == 0


def main():
    ap = argparse.ArgumentParser(description="Optimize raw videos for the web and update data/videos.js")
    ap.add_argument("--height", type=int, default=1080, help="longest-edge cap for landscape (portrait caps width). Default 1080; use 720 for lighter files")
    ap.add_argument("--crf", type=int, default=24, help="quality, lower = better and bigger (default 24; range 20-28 is sensible)")
    ap.add_argument("--maxrate", default="4500k", help="bitrate ceiling (default 4500k)")
    ap.add_argument("--poster-at", type=float, default=1.0, help="seconds into the video for the poster frame (default 1.0)")
    ap.add_argument("--force", action="store_true", help="re-encode files that were already processed")
    args = ap.parse_args()

    ffmpeg, ffprobe = need("ffmpeg"), need("ffprobe")
    for c in CATEGORIES:
        (RAW / c).mkdir(parents=True, exist_ok=True)
        (MEDIA / c).mkdir(parents=True, exist_ok=True)

    videos = load_videos()
    known = {v["id"]: v for v in videos}
    processed, rows, failed = [], [], []

    for cat in CATEGORIES:
        files = sorted(p for p in (RAW / cat).iterdir() if p.is_file() and p.suffix.lower() in EXTS)
        for src in files:
            slug = slugify(src.stem)
            vid = f"{cat}-{slug}"
            out_v, out_p = MEDIA / cat / f"{slug}.mp4", MEDIA / cat / f"{slug}.jpg"
            fresh = out_v.exists() and out_p.exists() and out_v.stat().st_mtime >= src.stat().st_mtime
            if fresh and not args.force and vid in known:
                print(f"skip   {cat}/{src.name} (already optimized; use --force to redo)")
                continue
            print(f"\n{cat}/{src.name}  ({mb(src.stat().st_size)})")
            if not (fresh and not args.force):
                if not encode(ffmpeg, src, out_v, args.height, args.crf, args.maxrate):
                    print(f"  FAILED to encode {src.name}. Is the file complete and playable?")
                    failed.append(src.name)
                    continue
            info = probe(ffprobe, out_v)
            if not info:
                print(f"  FAILED to read {out_v.name}")
                failed.append(src.name)
                continue
            if args.force or not out_p.exists():
                poster(ffmpeg, out_v, out_p, info, args.poster_at)

            entry = known.get(vid)
            if entry is None:
                entry = {"id": vid, "category": cat, "title": pretty_title(src.stem)}
                videos.append(entry)
                known[vid] = entry
                processed.append(entry)
            entry.update({
                "src": f"media/{cat}/{slug}.mp4",
                "poster": f"media/{cat}/{slug}.jpg",
                "aspect": f"{info['w']}/{info['h']}",
                "duration": int(round(info["dur"])),
            })
            entry.setdefault("starred", False)
            rows.append((src.name, src.stat().st_size, out_v.stat().st_size))
            print(f"  -> {out_v.name}  {mb(out_v.stat().st_size)}  ({info['w']}x{info['h']}, {int(round(info['dur']))}s)")

    # drop placeholder samples once real videos exist
    if any(not v.get("sample") for v in videos):
        before = len(videos)
        videos = [v for v in videos if not v.get("sample")]
        if len(videos) != before:
            print(f"\nRemoved {before - len(videos)} placeholder sample entries.")

    # every category with videos gets exactly one star (the first one, until you choose another)
    for cat in CATEGORIES:
        group = [v for v in videos if v.get("category") == cat]
        if group and not any(v.get("starred") for v in group):
            group[0]["starred"] = True

    save_videos(videos)

    if rows:
        before, after = sum(r[1] for r in rows), sum(r[2] for r in rows)
        print(f"\nDone. {len(rows)} file(s): {mb(before)} -> {mb(after)} ({100 - after * 100 // max(before, 1)}% smaller).")
    else:
        print("\nNothing new to process. Put files in raw/short, raw/long or raw/colour first.")
    if failed:
        print("Failed: " + ", ".join(failed))
    if processed:
        print("New titles were made from the file names. Edit them in data/videos.js (or rename the raw files and re-run with --force).")
    print("Next: upload the media/ folder to your video host, then deploy the site (see README.md).")


if __name__ == "__main__":
    main()
