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

const RATES = [1, 1.2, 1.5, 0.8];

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
      // number clip + one joined clip (question, pause, answer, pause)
      const clips = [`/audio/num/${current + 1}.mp3`, `${dir}/${key}_qa.mp3`];
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

  const cycleRate = () => {
    const i = RATES.indexOf(rate);
    setRate(RATES[(i + 1) % RATES.length]);
  };

  const small =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-base font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 disabled:opacity-40";

  return (
    <div className="flex items-center gap-2 text-white">
      <button
        onClick={togglePlay}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-blue-700 shadow-md transition hover:bg-blue-50"
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>

      <button
        onClick={() => goTo(-1)}
        disabled={current === 0}
        aria-label="Previous question"
        className={small}
      >
        ⏮
      </button>
      <button
        onClick={() => goTo(1)}
        disabled={current === order.length - 1}
        aria-label="Next question"
        className={small}
      >
        ⏭
      </button>

      <button
        onClick={cycleRate}
        aria-label="Playback speed"
        className={`${small} w-auto px-3 text-xs`}
      >
        {rate}x
      </button>

      <span className="ml-auto hidden text-[11px] leading-tight text-blue-100 sm:block">
        🎧 Reads the question, pauses, then the answer
      </span>
    </div>
  );
}
