"use client";

import { useEffect, useRef, useState } from "react";

type Question = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
};

type Segment = { text: string } | { pause: number };

type Props = {
  order: Question[];
  current: number;
  setCurrent: (updater: (prev: number) => number) => void;
};

const RATES = [0.8, 1, 1.2, 1.5];

// Long utterances get cut off by some browsers, so speak in short chunks.
function chunk(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?;:]+[.!?;:]?\s*/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > max && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function buildSegments(
  q: Question,
  number: number,
  readOptions: boolean,
  readExplanation: boolean,
): Segment[] {
  const segs: Segment[] = [];
  const add = (text: string) => chunk(text).forEach((t) => segs.push({ text: t }));

  add(`Question ${number}. ${q.pregunta}`);

  if (readOptions) {
    segs.push({ pause: 500 });
    q.opciones.forEach((op, i) => {
      add(`${String.fromCharCode(65 + i)}. ${op}`);
      segs.push({ pause: 300 });
    });
  }

  segs.push({ pause: 2500 });
  add(
    `The correct answer is ${String.fromCharCode(65 + q.correcta)}. ${q.opciones[q.correcta]}`,
  );

  if (readExplanation && q.explicacion) {
    segs.push({ pause: 400 });
    add(q.explicacion);
  }

  segs.push({ pause: 1800 });
  return segs;
}

export default function AudioPlayer({ order, current, setCurrent }: Props) {
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [readOptions, setReadOptions] = useState(false);
  const [readExplanation, setReadExplanation] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
    }
  }, []);

  // Keep the screen awake while playing (speech stops if the phone locks).
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          const lock = await navigator.wakeLock.request("screen");
          if (cancelled) {
            lock.release().catch(() => {});
          } else {
            wakeLockRef.current = lock;
          }
        }
      } catch {
        // not available / denied
      }
    };
    request();
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [playing]);

  // The speaking loop: reads the current question, then moves to the next.
  useEffect(() => {
    if (!playing || !supported) return;
    const q = order[current];
    if (!q) return;

    const synth = window.speechSynthesis;
    const segments = buildSegments(q, current + 1, readOptions, readExplanation);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const voices = synth.getVoices();
    const voice =
      voices.find((v) => v.lang === "en-US" && /natural|google|samantha|aria/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en"));

    const finish = () => {
      if (cancelled) return;
      if (current < order.length - 1) {
        setCurrent((prev) => prev + 1);
      } else {
        setPlaying(false);
      }
    };

    const run = (i: number) => {
      if (cancelled) return;
      if (i >= segments.length) {
        finish();
        return;
      }
      const seg = segments[i];
      if ("pause" in seg) {
        timer = setTimeout(() => run(i + 1), seg.pause);
        return;
      }
      const u = new SpeechSynthesisUtterance(seg.text);
      u.lang = "en-US";
      u.rate = rate;
      if (voice) u.voice = voice;
      u.onend = () => run(i + 1);
      u.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted") return;
        run(i + 1);
      };
      synth.speak(u);
    };

    synth.cancel();
    run(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      synth.cancel();
    };
  }, [playing, supported, current, order, rate, readOptions, readExplanation, setCurrent]);

  // Stop speaking when the component goes away.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) {
    return (
      <div className="mb-5 rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-blue-200">
        Audio is not supported in this browser.
      </div>
    );
  }

  const goTo = (delta: number) => {
    setCurrent((prev) => Math.min(Math.max(prev + delta, 0), order.length - 1));
  };

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-600 p-4 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm font-bold">🎧 Audio mode</p>
          <p className="text-xs text-blue-100">
            Reads each question, then the correct answer, and moves on.
          </p>
        </div>

        <button
          onClick={() => goTo(-1)}
          disabled={current === 0}
          aria-label="Previous question"
          className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold ring-1 ring-white/25 transition hover:bg-white/25 disabled:opacity-40"
        >
          ⏮
        </button>

        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-xl bg-white px-5 py-2 text-sm font-bold text-blue-700 shadow-md transition hover:bg-blue-50"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <button
          onClick={() => goTo(1)}
          disabled={current === order.length - 1}
          aria-label="Next question"
          className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold ring-1 ring-white/25 transition hover:bg-white/25 disabled:opacity-40"
        >
          ⏭
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-blue-100">Speed</span>
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => setRate(r)}
              className={`rounded-lg px-2 py-1 font-semibold transition ${
                rate === r
                  ? "bg-white text-blue-700"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {r}x
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={readOptions}
            onChange={(e) => setReadOptions(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          Read the options
        </label>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={readExplanation}
            onChange={(e) => setReadExplanation(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          Read the explanation
        </label>
      </div>
    </div>
  );
}
