#!/usr/bin/env python3
"""Native FFmpeg benchmark for the ffmpeg-webCLI paper (Table 3).

Args mirror the webCLI presets exactly. 3 runs per cell, medians computed later.
Writes benchmark/results_native.csv incrementally.
"""
import csv
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
VID = ROOT / "video"
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)
CSV = ROOT / "results_native.csv"

CLIPS = {"60s": ("small.mp4", 60.292), "150s": ("medium.mp4", 150.042), "600s": ("long.mp4", 596.544)}
RUNS = 3

# op -> condition -> args builder (input path, half-duration) -> (args, out_ext)
def ops(inp, half):
    return {
        "webm_vp9": {
            "sw": (["-i", inp, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-c:a", "libopus"], "webm"),
        },
        "compress_crf28": {
            "sw": (["-i", inp, "-vf", "scale=1920:1080", "-c:v", "libx264", "-crf", "28", "-preset", "medium", "-c:a", "aac", "-b:a", "128k"], "mp4"),
            "hw": (["-i", inp, "-vf", "scale=1920:1080", "-c:v", "h264_videotoolbox", "-q:v", "55", "-c:a", "aac", "-b:a", "128k"], "mp4"),
        },
        "audio_mp3": {
            "sw": (["-i", inp, "-vn", "-c:a", "libmp3lame", "-q:a", "2"], "mp3"),
        },
        "gif_480_15": {
            "sw": (["-i", inp, "-vf", "fps=15,scale=480:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", "-an"], "gif"),
        },
        "trim_copy": {
            "sw": (["-ss", "0", "-i", inp, "-t", f"{half:.3f}", "-c:v", "copy", "-c:a", "copy"], "mp4"),
        },
        "stripmeta_copy": {
            "sw": (["-i", inp, "-map_metadata", "-1", "-c:v", "copy", "-c:a", "copy"], "mp4"),
        },
        "rotate90": {
            "sw": (["-i", inp, "-vf", "transpose=1", "-c:v", "libx264", "-preset", "fast", "-c:a", "aac"], "mp4"),
            "hw": (["-i", inp, "-vf", "transpose=1", "-c:v", "h264_videotoolbox", "-q:v", "55", "-c:a", "aac"], "mp4"),
        },
    }


def main():
    new = not CSV.exists()
    with open(CSV, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["op", "duration", "condition", "run", "seconds", "out_bytes"])
        for dur, (fname, secs) in CLIPS.items():
            inp = str(VID / fname)
            table = ops(inp, secs / 2)
            for op, conds in table.items():
                for cond, (args, ext) in conds.items():
                    for run in range(1, RUNS + 1):
                        dst = OUT / f"{op}_{dur}_{cond}.{ext}"
                        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"] + args + [str(dst)]
                        t0 = time.perf_counter()
                        r = subprocess.run(cmd, capture_output=True)
                        dt = time.perf_counter() - t0
                        if r.returncode != 0:
                            print(f"FAIL {op} {dur} {cond} run{run}: {r.stderr.decode()[:200]}", flush=True)
                            w.writerow([op, dur, cond, run, "FAIL", 0])
                        else:
                            w.writerow([op, dur, cond, run, f"{dt:.2f}", dst.stat().st_size])
                            print(f"{op} {dur} {cond} run{run}: {dt:.2f}s", flush=True)
                        f.flush()
    print("DONE", flush=True)


if __name__ == "__main__":
    sys.exit(main())
