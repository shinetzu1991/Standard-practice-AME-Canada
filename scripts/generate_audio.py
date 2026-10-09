"""Generate natural-sounding audio for the question banks (Microsoft neural voices via edge-tts).

Usage (from the project root):
    python scripts/generate_audio.py airframe          # generate / update one bank
    python scripts/generate_audio.py airframe --limit 5

Requirements: pip install edge-tts, and ffmpeg on the PATH.

For every question it creates one file in public/audio/<category>/:
    <key>_qa.mp3   the question, a 2.5 s pause, "Answer: <correct option>", then a 1 s pause
(the question and answer are synthesized separately and joined; one file per question
means fewer file changes during playback, which is more reliable with the phone locked)
where <key> is a hash of (question + correct answer) that app/AudioPlayer.tsx computes
the same way, so editing a question automatically triggers new audio on the next run.
Also writes: public/audio/num/<n>.mp3 ("Question n"), public/audio/silence.mp3 and
public/audio/manifest.json (the list of keys that have audio).
"""

import argparse
import asyncio
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
VOICE = "en-US-AndrewNeural"
MAX_NUMBER = 1000
CONCURRENCY = 6


def audio_key(question: str, answer: str) -> str:
    """Two 32-bit FNV-1a hashes over UTF-8 (identical implementation in AudioPlayer.tsx)."""
    data = (question + "\n" + answer).encode("utf-8")
    h1, h2 = 0x811C9DC5, 0x9747B28C
    for b in data:
        h1 = ((h1 ^ b) * 0x01000193) & 0xFFFFFFFF
        h2 = ((h2 ^ b) * 0x01000193) & 0xFFFFFFFF
    return f"{h1:08x}{h2:08x}"


ORD = {2: "half", 3: "third", 4: "quarter", 8: "eighth", 16: "sixteenth", 32: "thirty-second", 64: "sixty-fourth"}
NUM = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
       10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 15: "fifteen", 31: "thirty-one"}
KEEP_AS_WORDS = {"MIL", "ALL", "NOT", "AND", "OR", "THE", "IN", "OF", "TO", "ON", "NO", "YES", "ANY", "ARE", "FOR"}


def fraction(m: re.Match) -> str:
    n, d = int(m.group(1)), int(m.group(2))
    if d in ORD and 0 < n < d:
        word = ORD[d] if n == 1 else (ORD[d] + ("s" if d != 2 else "s")).replace("halfs", "halves")
        return f"{NUM.get(n, str(n))} {word}"
    return m.group(0)


def mixed_number(m: re.Match) -> str:
    n, d = int(m.group(2)), int(m.group(3))
    if n == 1 and d == 2:
        return f"{m.group(1)} and a half"
    if d in ORD and 0 < n < d:
        return f"{m.group(1)} and " + fraction(re.match(r"(\d+)/(\d+)", f"{n}/{d}"))
    return m.group(0)


def speakable(text: str) -> str:
    t = text.strip()
    t = re.sub(r":contentReference\[[^\]]*\]\{[^}]*\}", "", t)
    t = re.sub(r"\bA/C\b", "aircraft", t, flags=re.I)
    t = re.sub(r"\bft/min\b", "feet per minute", t, flags=re.I)
    t = re.sub(r"\bin\.(?=\s+of\b)", "inches", t)
    t = re.sub(r"\b(\d+) (\d+)/(\d+)\b", mixed_number, t)
    t = t.replace("vs.", "versus").replace("e.g.", "for example").replace("i.e.", "that is")
    t = t.replace("&", " and ")
    t = re.sub(r"(\d+)\s*°\s*([CF])\b", r"\1 degrees \2", t)
    t = t.replace("°", " degrees").replace("�", " degrees")
    t = re.sub(r"(\d)\s*%", r"\1 percent", t)
    t = re.sub(r"\b(\d+)/(\d+)\b", fraction, t)
    t = re.sub(r"\b(\d+):(\d+)\b", r"\1 to \2", t)
    t = re.sub(r"(\d)\s*[–~]\s*(\d)", r"\1 to \2", t)
    t = re.sub(
        r"(\d)\s*-\s*(\d+)(\s+(?:percent|mph|psi|ft|feet|inches|inch|hours|minutes|microns|volts|degrees|knots|kts))",
        r"\1 to \2\3",
        t,
    )
    t = re.sub(r"\bpsi\b", "P S I", t, flags=re.I)
    t = re.sub(r"\bmph\b", "miles per hour", t, flags=re.I)
    t = re.sub(r"\bkts\b", "knots", t, flags=re.I)

    def spell(m: re.Match) -> str:
        w = m.group(0)
        return w if w in KEEP_AS_WORDS else " ".join(w)

    t = re.sub(r"\b[A-Z]{2,5}\b", spell, t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


async def synth(text: str, out: Path, sem: asyncio.Semaphore) -> bool:
    async with sem:
        for attempt in range(4):
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    raw = Path(tmp) / "raw.mp3"
                    await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(raw))
                    subprocess.run(
                        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ac", "1", "-ar", "24000", "-b:a", "32k", str(out)],
                        check=True,
                    )
                return True
            except Exception as e:  # noqa: BLE001
                print(f"  retry {attempt + 1} for {out.name}: {e}", file=sys.stderr)
                await asyncio.sleep(2 * (attempt + 1))
        return False


def make_silence(path: Path, seconds: float = 2.5) -> None:
    """Silent clip used as a pause between question and answer (and between questions)."""
    if path.exists():
        return
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", str(seconds), "-ac", "1", "-b:a", "32k", str(path)],
        check=True,
    )


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("category", choices=["airframe", "powerplant", "standard"])
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    bank_file = {"airframe": "airframe.json", "powerplant": "powerplant.json", "standard": "questions.json"}[args.category]
    questions = json.loads((ROOT / "data" / bank_file).read_text(encoding="utf-8"))
    if args.limit:
        questions = questions[: args.limit]

    out_dir = AUDIO / args.category
    out_dir.mkdir(parents=True, exist_ok=True)
    (AUDIO / "num").mkdir(parents=True, exist_ok=True)
    make_silence(AUDIO / "silence.mp3")
    make_silence(AUDIO / "pause.mp3", 1.0)

    sem = asyncio.Semaphore(CONCURRENCY)
    jobs: list[tuple[str, Path]] = []
    keys: list[str] = []
    for q in questions:
        answer = q["opciones"][q["correcta"]]
        key = audio_key(q["pregunta"], answer)
        keys.append(key)
        for suffix, text in (("q", speakable(q["pregunta"])), ("a", "Answer: " + speakable(answer))):
            f = out_dir / f"{key}_{suffix}.mp3"
            if not f.exists() and not (out_dir / f"{key}_qa.mp3").exists():
                jobs.append((text, f))

    for n in range(1, MAX_NUMBER + 1):
        f = AUDIO / "num" / f"{n}.mp3"
        if not f.exists():
            jobs.append((f"Question {n}.", f))

    print(f"{len(jobs)} clips to generate ({len(keys)} questions)")
    done = 0
    failed: list[Path] = []

    async def run(text: str, f: Path) -> None:
        nonlocal done
        ok = await synth(text, f, sem)
        done += 1
        if not ok:
            failed.append(f)
        if done % 50 == 0:
            print(f"  {done}/{len(jobs)}")

    await asyncio.gather(*(run(t, f) for t, f in jobs))

    # join question + pause + answer + pause into one file per question
    for k in dict.fromkeys(keys):
        qa = out_dir / f"{k}_qa.mp3"
        qf, af = out_dir / f"{k}_q.mp3", out_dir / f"{k}_a.mp3"
        if qa.exists() or not (qf.exists() and af.exists()):
            continue
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(qf), "-i", str(AUDIO / "silence.mp3"), "-i", str(af),
             "-i", str(AUDIO / "pause.mp3"), "-filter_complex", "concat=n=4:v=0:a=1",
             "-ac", "1", "-ar", "24000", "-b:a", "32k", str(qa)],
            check=True,
        )
        qf.unlink()
        af.unlink()

    # manifest: only keys that have their joined file
    valid = sorted({k for k in keys if (out_dir / f"{k}_qa.mp3").exists()})
    manifest_path = AUDIO / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest[args.category] = valid
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    # remove orphaned files from edited / deleted questions
    if not args.limit:
        keep = set(valid)
        for f in out_dir.glob("*.mp3"):
            if f.name.split("_")[0] not in keep:
                f.unlink()

    print(f"done: {len(valid)} questions with audio, {len(failed)} failed")
    for f in failed:
        print("  FAILED", f.name)


if __name__ == "__main__":
    asyncio.run(main())
