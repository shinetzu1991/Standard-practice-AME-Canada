"use client";

import { useEffect, useRef, useState } from "react";

type Question = {
  pregunta: string;
  opciones: string[];
  correcta: number;
};

type Props = {
  category: string;
  order: Question[];
  current: number;
  setCurrent: (updater: (prev: number) => number) => void;
};

const RATES = [0.8, 1, 1.2, 1.5];

// Same hash as scripts/generate_audio.py (two 32-bit FNV-1a over UTF-8 bytes).
function audioKey(question: string, answer: string): string {
  const data = new TextEncoder().encode(question + "\n" + answer);
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (const b of data) {
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ b, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

// Fallback voice (browser speech) for questions that have no recorded audio yet.
function fallbackText(q: Question, number: number): string[] {
  return [
    `Question ${number}. ${q.pregunta}`,
    `Answer: ${q.opciones[q.correcta]}`,
  ];
}

export default function AudioPlayer({
  category,
  order,
  current,
  setCurrent,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/audio/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string[]>) => {
        if (!cancelled) setAvailable(new Set(m[category] ?? []));
      })
      .catch(() => {
        if (!cancelled) setAvailable(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  };

  // Keep the screen awake while playing (helps phones that stop audio on lock).
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          const lock = await navigator.wakeLock.request("screen");
          if (cancelled) lock.release().catch(() => {});
          else wakeLockRef.current = lock;
        }
      } catch {
        // not available / denied
      }
    })();
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [playing]);

  // The playing loop: one question at a time, then move to the next.
  useEffect(() => {
    if (!playing || available === null) return;
    const q = order[current];
    if (!q) return;

    let cancelled = false;
    const goNext = () => {
      if (cancelled) return;
      if (current < order.length - 1) setCurrent((prev) => prev + 1);
      else setPlaying(false);
    };

    const key = audioKey(q.pregunta, q.opciones[q.correcta]);
    const dir = `/audio/${category}`;
    let cleanup = () => {};

    if (available.has(key) && current + 1 <= 1000) {
      const audio = getAudio();
      const clips = [
        `/audio/num/${current + 1}.mp3`,
        `${dir}/${key}_q.mp3`,
        `/audio/silence.mp3`,
        `${dir}/${key}_a.mp3`,
        `/audio/pause.mp3`,
      ];
      let i = 0;
      const playClip = () => {
        if (cancelled) return;
        if (i >= clips.length) {
          goNext();
          return;
        }
        audio.src = clips[i];
        audio.playbackRate = rate;
        audio.play().catch(() => {
          // blocked or missing file: skip ahead rather than stalling
          if (!cancelled) {
            i += 1;
            playClip();
          }
        });
      };
      audio.onended = () => {
        i += 1;
        playClip();
      };
      audio.onerror = () => {
        i += 1;
        playClip();
      };
      playClip();
      cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      };
    } else if ("speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      const parts = fallbackText(q, current + 1);
      let i = 0;
      const speak = () => {
        if (cancelled) return;
        if (i >= parts.length) {
          setTimeout(goNext, 1200);
          return;
        }
        const u = new SpeechSynthesisUtterance(parts[i]);
        u.lang = "en-US";
        u.rate = rate;
        u.onend = () => {
          i += 1;
          setTimeout(speak, i === 1 ? 2500 : 0);
        };
        u.onerror = (e) => {
          if (e.error === "canceled" || e.error === "interrupted") return;
          i += 1;
          speak();
        };
        synth.speak(u);
      };
      synth.cancel();
      speak();
      cleanup = () => synth.cancel();
    } else {
      setPlaying(false);
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [playing, available, category, current, order, rate, setCurrent]);

  // Lock-screen / Bluetooth controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: `Question ${current + 1} / ${order.length}`,
      artist: "M2 Canada",
      album: category.toUpperCase(),
    });
    ms.playbackState = playing ? "playing" : "paused";
    ms.setActionHandler("play", () => setPlaying(true));
    ms.setActionHandler("pause", () => setPlaying(false));
    ms.setActionHandler("nexttrack", () =>
      setCurrent((p) => Math.min(p + 1, order.length - 1)),
    );
    ms.setActionHandler("previoustrack", () =>
      setCurrent((p) => Math.max(p - 1, 0)),
    );
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
    };
  }, [current, order.length, playing, category, setCurrent]);

  // Stop everything when the component goes away.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!playing) {
      // Unlock audio inside the tap (needed by iPhone/Safari), then start.
      const audio = getAudio();
      audio.src = "/audio/silence.mp3";
      audio.play().catch(() => {});
    }
    setPlaying((p) => !p);
  };

  const goTo = (delta: number) => {
    setCurrent((prev) => Math.min(Math.max(prev + delta, 0), order.length - 1));
  };

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-600 p-4 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm font-bold">🎧 Audio mode</p>
          <p className="text-xs text-blue-100">
            Reads the question number, the question and the correct answer, then
            moves on.
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
          onClick={togglePlay}
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

      <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-blue-100">Speed</span>
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
    </div>
  );
}
