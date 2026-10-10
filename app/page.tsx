"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AudioPlayer from "./AudioPlayer";
import rawStandardQuestions from "../data/questions.json";
import rawAirframeQuestions from "../data/airframe.json";
import rawPowerplantQuestions from "../data/powerplant.json";

type Question = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  imagen?: string;
  tema?: string;
};

type Category = "standard" | "airframe" | "powerplant";
type QuizMode = "test" | "study" | "study100" | "topic";

const SHOW_POWERPLANT = true;

const CATEGORIES: { key: Category; label: string; short: string }[] = [
  { key: "standard", label: "Standard Practices", short: "Standard" },
  { key: "airframe", label: "Airframe", short: "Airframe" },
  ...(SHOW_POWERPLANT
    ? [{ key: "powerplant" as Category, label: "Powerplant", short: "Powerplant" }]
    : []),
];

// Canonical topic order per bank (same names as scripts/classify_topics.py).
const TOPIC_ORDER: Record<Category, string[]> = {
  standard: [
    "Physics & Math",
    "Electrical",
    "Hardware, Materials & Processes",
    "Hydraulics & Pneumatics",
    "Drawings, Documents & Regulations",
  ],
  airframe: [
    "Helicopters",
    "Hydraulics, Landing Gear & Brakes",
    "Flight Controls & Aerodynamics",
    "Structures, Fabric & Sheet Metal",
    "Pressurization, Air Conditioning & Oxygen",
    "Electrical, Instruments & Avionics",
    "Fuel Systems & Weight and Balance",
  ],
  powerplant: [
    "Piston engines",
    "Propellers",
    "Turbine engines",
    "Engine Systems & Electrical",
  ],
};

const questionBanks: Record<Category, Question[]> = {
  standard: rawStandardQuestions as Question[],
  airframe: rawAirframeQuestions as Question[],
  powerplant: rawPowerplantQuestions as Question[],
};

function topicsFor(category: Category): { name: string; count: number }[] {
  const bank = questionBanks[category];
  return TOPIC_ORDER[category]
    .map((name) => ({ name, count: bank.filter((q) => q.tema === name).length }))
    .filter((t) => t.count > 0);
}

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const PROGRESS_KEY = "ame-exam-progress";

type SavedProgress = {
  category: Category;
  mode: QuizMode;
  topic?: string | null;
  order: Question[];
  current: number;
  selectedAnswers: (number | null)[];
  checkedAnswers: boolean[];
  finished: boolean;
};

// Questions already answered in Test Mode, per section, so the next test draws
// from the ones not seen yet. When fewer than a full test remain, the remaining
// ones are used first and the rest is filled from the old pool, which then restarts.
const TEST_SEEN_KEY = "ame-test-seen";
type SeenMap = Partial<Record<Category, string[]>>;

function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(TEST_SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function saveSeen(map: SeenMap) {
  try {
    localStorage.setItem(TEST_SEEN_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

const TEST_SIZE = 90;

function pickTestQuestions(bank: Question[], category: Category): Question[] {
  const seenMap = loadSeen();
  const seen = new Set(seenMap[category] ?? []);
  const unseen = bank.filter((q) => !seen.has(q.pregunta));
  const size = Math.min(TEST_SIZE, bank.length);

  if (unseen.length >= size) {
    return shuffleArray(unseen).slice(0, size);
  }

  // Not enough fresh questions: use all of them, top up from the old pool and
  // start a new cycle (only the top-up questions count as seen).
  const topUp = shuffleArray(bank.filter((q) => seen.has(q.pregunta))).slice(
    0,
    size - unseen.length,
  );
  saveSeen({ ...seenMap, [category]: topUp.map((q) => q.pregunta) });
  return shuffleArray([...unseen, ...topUp]);
}

function markSeen(category: Category, text: string) {
  const seenMap = loadSeen();
  const list = seenMap[category] ?? [];
  if (list.includes(text)) return;
  saveSeen({ ...seenMap, [category]: [...list, text] });
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (!parsed.order || parsed.order.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Shared style snippets (light + dark).
const PAGE_BG =
  "min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100";
const CARD =
  "rounded-3xl bg-gradient-to-b from-blue-50 to-sky-100 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 dark:from-slate-900 dark:to-slate-900 dark:shadow-black/40 dark:ring-slate-700";
const SIDE_CARD =
  "rounded-2xl bg-white/90 p-4 shadow-lg shadow-blue-900/10 ring-1 ring-blue-200 backdrop-blur dark:bg-slate-900/90 dark:ring-slate-700";
const BRAND =
  "bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-700 text-white dark:from-blue-950 dark:via-indigo-950 dark:to-slate-900";
const MUTED = "text-slate-500 dark:text-slate-400";
const BTN_PRIMARY =
  "rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-40";
const BTN_SOFT =
  "rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-200 dark:ring-slate-600 dark:hover:bg-slate-700";
const MENU_ITEM =
  "block w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800";
const MENU_ITEM_ACTIVE =
  "block w-full bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-indigo-700 dark:bg-slate-800 dark:text-indigo-300";

export default function Home() {
  const [category, setCategory] = useState<Category>("standard");
  const [mode, setMode] = useState<QuizMode>("test");
  const [topic, setTopic] = useState<string | null>(null);
  const [order, setOrder] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [checkedAnswers, setCheckedAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [studyMenuOpen, setStudyMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpTo, setJumpTo] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  const currentBank = questionBanks[category];

  const startQuiz = (
    selectedMode: QuizMode,
    selectedCategory: Category = category,
    initialQuestionNumber = 1,
    selectedTopic: string | null = null,
  ) => {
    const bank = questionBanks[selectedCategory];
    const sourceQuestions =
      selectedMode === "topic" && selectedTopic
        ? bank.filter((q) => q.tema === selectedTopic)
        : bank;
    if (sourceQuestions.length === 0) return;

    const loadedQuestions =
      selectedMode === "test"
        ? pickTestQuestions(sourceQuestions, selectedCategory)
        : selectedMode === "study100"
          ? shuffleArray(sourceQuestions).slice(
              0,
              Math.min(100, sourceQuestions.length),
            )
          : shuffleArray(sourceQuestions); // study / topic: always a random order

    const initialCurrent = Math.min(
      Math.max(initialQuestionNumber - 1, 0),
      loadedQuestions.length - 1,
    );

    setMode(selectedMode);
    setTopic(selectedMode === "topic" ? selectedTopic : null);
    setOrder(loadedQuestions);
    setCurrent(initialCurrent);
    setSelectedAnswers(new Array(loadedQuestions.length).fill(null));
    setCheckedAnswers(new Array(loadedQuestions.length).fill(false));
    setFinished(false);
    setStudyMenuOpen(false);
    setMoreOpen(false);
    setJumpOpen(false);
  };

  useEffect(() => {
    const saved = loadProgress();

    const params = new URLSearchParams(window.location.search);
    const hasUrlParams =
      params.has("category") || params.has("mode") || params.has("q");
    const categoryParam = params.get("category");
    const urlCategory: Category =
      categoryParam === "airframe" || categoryParam === "powerplant"
        ? categoryParam
        : "standard";
    const modeParam = params.get("mode");
    const urlTopic = params.get("topic");
    const urlMode: QuizMode =
      modeParam === "study" || modeParam === "study100"
        ? modeParam
        : modeParam === "topic" && urlTopic
          ? "topic"
          : "test";
    const urlQuestionNumber = parseInt(params.get("q") ?? "1", 10);

    const savedMatchesUrl =
      !!saved &&
      (!hasUrlParams ||
        (saved.category === urlCategory &&
          saved.mode === urlMode &&
          (urlMode !== "topic" || (saved.topic ?? null) === urlTopic)));

    if (saved && savedMatchesUrl) {
      // Saved progress stores full question objects; refresh them from the
      // current bank so edited questions/answers (and their audio) stay in sync.
      const byText = new Map(
        questionBanks[saved.category].map((q) => [q.pregunta, q] as const),
      );
      const refreshedOrder = saved.order.map((q) => byText.get(q.pregunta) ?? q);

      setCategory(saved.category);
      setMode(saved.mode);
      setTopic(saved.topic ?? null);
      setOrder(refreshedOrder);
      setCurrent(saved.current);
      setSelectedAnswers(saved.selectedAnswers);
      setCheckedAnswers(saved.checkedAnswers);
      setFinished(saved.finished);
    } else {
      setCategory(urlCategory);
      startQuiz(
        urlMode,
        urlCategory,
        Number.isFinite(urlQuestionNumber) ? urlQuestionNumber : 1,
        urlTopic,
      );
    }

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "not seen yet in Test Mode" counter in sync with storage.
  useEffect(() => {
    if (!hydrated) return;
    const bank = questionBanks[category];
    const seen = new Set(loadSeen()[category] ?? []);
    setSeenCount(bank.filter((q) => seen.has(q.pregunta)).length);
  }, [hydrated, category, order, selectedAnswers]);

  const resetTestPool = () => {
    const seenMap = loadSeen();
    delete seenMap[category];
    saveSeen(seenMap);
    setSeenCount(0);
    setMoreOpen(false);
  };

  const selectCategory = (newCategory: Category) => {
    setCategory(newCategory);
    startQuiz("test", newCategory);
  };

  useEffect(() => {
    if (!hydrated || order.length === 0) return;

    const data: SavedProgress = {
      category,
      mode,
      topic,
      order,
      current,
      selectedAnswers,
      checkedAnswers,
      finished,
    };

    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch {
      // ignore quota / storage errors
    }

    const params = new URLSearchParams({
      category,
      mode,
      q: String(current + 1),
    });
    if (mode === "topic" && topic) params.set("topic", topic);
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, [hydrated, category, mode, topic, order, current, selectedAnswers, checkedAnswers, finished]);

  const question = order[current];
  const isStudy = mode === "study" || mode === "study100" || mode === "topic";
  const selected = selectedAnswers[current] ?? null;
  const showAnswer = checkedAnswers[current] ?? false;

  const handleSelect = (index: number) => {
    if (!question || finished) return;
    if (isStudy && showAnswer) return;

    const updated = [...selectedAnswers];
    updated[current] = index;
    setSelectedAnswers(updated);

    if (mode === "test") {
      markSeen(category, question.pregunta);
    }

    if (isStudy) {
      const updatedChecked = [...checkedAnswers];
      updatedChecked[current] = true;
      setCheckedAnswers(updatedChecked);
    }
  };

  const nextQuestion = () => {
    setCurrent((prev) => Math.min(prev + 1, order.length - 1));
  };

  const prevQuestion = () => {
    setCurrent((prev) => Math.max(prev - 1, 0));
  };

  const finishTest = () => {
    setFinished(true);
    setMoreOpen(false);
  };

  // Keyboard shortcuts (desktop): 1-4 / A-D answer, arrows move, Enter = next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!question || finished) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        setCurrent((prev) => Math.min(prev + 1, order.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrent((prev) => Math.max(prev - 1, 0));
      } else if (/^[1-4]$/.test(e.key)) {
        handleSelect(parseInt(e.key, 10) - 1);
      } else if (/^[a-dA-D]$/.test(e.key)) {
        handleSelect(e.key.toLowerCase().charCodeAt(0) - 97);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, finished, isStudy, showAnswer, selectedAnswers, checkedAnswers, current, order.length]);

  if (order.length === 0 || !question) {
    return (
      <div className={`${PAGE_BG} flex items-center justify-center`}>
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-5 py-4 text-sm font-semibold text-blue-800 shadow-lg dark:bg-slate-900/80 dark:text-blue-200">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
          Loading questions…
        </div>
      </div>
    );
  }

  const answeredCount = selectedAnswers.filter((a) => a !== null).length;
  const score = order.reduce((total, q, index) => {
    return selectedAnswers[index] === q.correcta ? total + 1 : total;
  }, 0);
  const studyWrong = order.reduce((total, q, index) => {
    return checkedAnswers[index] &&
      selectedAnswers[index] !== null &&
      selectedAnswers[index] !== q.correcta
      ? total + 1
      : total;
  }, 0);

  const percentage =
    order.length > 0 ? ((score / order.length) * 100).toFixed(1) : "0";

  const wrongAnswers = order
    .map((q, index) => ({
      questionNumber: index + 1,
      pregunta: q.pregunta,
      tema: q.tema,
      selected:
        selectedAnswers[index] !== null
          ? q.opciones[selectedAnswers[index] as number]
          : "No answer selected",
      correct: q.opciones[q.correcta],
      explicacion: q.explicacion,
      imagen: q.imagen,
    }))
    .filter((_, index) => selectedAnswers[index] !== order[index].correcta);

  const topicStats = TOPIC_ORDER[category]
    .map((name) => {
      const total = order.filter((q) => q.tema === name).length;
      const wrong = wrongAnswers.filter((w) => w.tema === name).length;
      return { name, total, wrong };
    })
    .filter((t) => t.total > 0);

  const getOptionClass = (i: number) => {
    const neutral =
      "border-blue-100 bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-700";
    const picked =
      "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950/60 dark:ring-blue-800";

    if (mode === "test" && !finished) {
      return selected === i ? picked : neutral;
    }
    if (isStudy && !showAnswer) {
      return selected === i ? picked : neutral;
    }
    if (i === question.correcta) {
      return "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-950/60 dark:ring-emerald-800";
    }
    if (selected === i && i !== question.correcta) {
      return "border-rose-500 bg-rose-50 ring-2 ring-rose-200 dark:bg-rose-950/60 dark:ring-rose-800";
    }
    return "border-blue-100 bg-white dark:border-slate-700 dark:bg-slate-800";
  };

  const categoryTitle =
    CATEGORIES.find((c) => c.key === category)?.label.toUpperCase() ?? "";

  const modeLabel =
    mode === "test"
      ? "Test mode"
      : mode === "study100"
        ? "Study · 100 random"
        : mode === "topic"
          ? `Study · ${topic ?? ""}`
          : "Study · full bank";

  const submitJump = () => {
    const n = parseInt(jumpTo, 10);
    if (Number.isFinite(n)) {
      setCurrent(Math.min(Math.max(n, 1), order.length) - 1);
    }
    setJumpTo("");
    setJumpOpen(false);
    setMoreOpen(false);
  };

  // ---------- shared pieces ----------

  const studyChoices = (
    <>
      <button
        onClick={() => startQuiz("study")}
        className={mode === "study" ? MENU_ITEM_ACTIVE : MENU_ITEM}
      >
        Full question bank
        <span className={`ml-2 text-xs ${MUTED}`}>{currentBank.length}</span>
      </button>
      <button
        onClick={() => startQuiz("study100")}
        className={mode === "study100" ? MENU_ITEM_ACTIVE : MENU_ITEM}
      >
        100 random questions
      </button>
      <p className="border-t border-blue-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:border-slate-700 dark:text-blue-300">
        By topic
      </p>
      {topicsFor(category).map((t) => (
        <button
          key={t.name}
          onClick={() => startQuiz("topic", category, 1, t.name)}
          className={`${
            mode === "topic" && topic === t.name ? MENU_ITEM_ACTIVE : MENU_ITEM
          } flex items-center justify-between gap-2 !py-2.5`}
        >
          <span>{t.name}</span>
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-slate-700 dark:text-blue-200">
            {t.count}
          </span>
        </button>
      ))}
    </>
  );

  const sidebar = (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-6 space-y-4">
        <div className={`${BRAND} rounded-2xl p-5 shadow-xl shadow-blue-900/20`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/25">
              ✈
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight">M2 Canada</p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-blue-200">
                AME exam preparation
              </p>
            </div>
          </div>
        </div>

        <div className={SIDE_CARD}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Section
          </p>
          <div className="space-y-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => selectCategory(c.key)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  category === c.key
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {c.label}
                <span
                  className={`text-xs ${category === c.key ? "text-blue-100" : MUTED}`}
                >
                  {questionBanks[c.key].length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={`${SIDE_CARD} !p-0`}>
          <p className="px-4 pt-4 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Mode
          </p>
          <div className="py-2">
            <button
              onClick={() => startQuiz("test")}
              className={mode === "test" ? MENU_ITEM_ACTIVE : MENU_ITEM}
            >
              Test mode
              <span className={`ml-2 text-xs ${MUTED}`}>90 questions</span>
            </button>
            {studyChoices}
          </div>
        </div>

        <div className={SIDE_CARD}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Progress
          </p>
          <p className="text-sm font-semibold">
            Question {current + 1}
            <span className={`font-medium ${MUTED}`}> / {order.length}</span>
          </p>
          {isStudy ? (
            <p className={`mt-1 text-sm ${MUTED}`}>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {score} ✓
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {studyWrong} ✗
              </span>
            </p>
          ) : (
            <p className={`mt-1 text-sm ${MUTED}`}>
              Answered {answeredCount} / {order.length}
            </p>
          )}
          <p className={`mt-2 text-xs ${MUTED}`}>
            Not yet seen in Test Mode:{" "}
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {currentBank.length - seenCount}
            </span>{" "}
            / {currentBank.length}
          </p>
          <p className={`mt-3 text-[11px] ${MUTED}`}>
            Keys: 1–4 answer · ← → move · Enter next
          </p>
        </div>
      </div>
    </aside>
  );

  const mobileHeader = (
    <header
      className={`${BRAND} mb-3 rounded-2xl p-3 shadow-lg shadow-blue-900/20 lg:hidden`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-lg ring-1 ring-white/25">
            ✈
          </span>
          <span className="text-base font-extrabold tracking-tight">M2 Canada</span>
        </div>
        <div className="flex gap-1 rounded-xl bg-blue-950/40 p-1">
          <button
            onClick={() => startQuiz("test")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "test" ? "bg-white text-blue-800 shadow" : "text-blue-100"
            }`}
          >
            Test
          </button>
          <button
            onClick={() => setStudyMenuOpen(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isStudy ? "bg-white text-blue-800 shadow" : "text-blue-100"
            }`}
          >
            Study ▾
          </button>
        </div>
      </div>
      <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => selectCategory(c.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              category === c.key
                ? "bg-white text-blue-800 shadow"
                : "bg-white/10 text-blue-100 ring-1 ring-white/20"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </header>
  );

  const studySheet = studyMenuOpen && (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        aria-label="Close"
        onClick={() => setStudyMenuOpen(false)}
        className="absolute inset-0 bg-slate-900/50"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-slate-900">
        <div className="sticky top-0 bg-white px-4 pb-2 pt-3 dark:bg-slate-900">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Study mode · {categoryTitle}
          </p>
        </div>
        <div className="pb-3">{studyChoices}</div>
      </div>
    </div>
  );

  // ---------- results screen ----------

  if (finished && mode === "test") {
    return (
      <div className={PAGE_BG}>
        <div className="mx-auto flex w-full max-w-6xl gap-6 px-3 pb-10 pt-3 sm:px-6 sm:pt-6">
          {sidebar}
          <main className="min-w-0 flex-1">
            {mobileHeader}
            <div className={`${CARD} p-5 sm:p-8`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                {categoryTitle}
              </p>
              <h1 className="mb-5 text-3xl font-extrabold">Test Results</h1>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                    Final Score
                  </p>
                  <p className="mt-1 text-3xl font-extrabold">
                    {score} / {order.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200 dark:bg-slate-800 dark:ring-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    Percentage
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-sky-800 dark:text-sky-200">
                    {percentage}%
                  </p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Incorrect Answers
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-rose-700 dark:text-rose-300">
                    {wrongAnswers.length}
                  </p>
                </div>
              </div>

              {topicStats.length > 0 && (
                <div className="mb-6 rounded-2xl bg-white p-4 ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                    Results by topic
                  </h2>
                  <div className="space-y-2.5">
                    {topicStats.map((t) => {
                      const ok = t.total - t.wrong;
                      const pct = Math.round((ok / t.total) * 100);
                      return (
                        <div key={t.name}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium">{t.name}</span>
                            <span className={`shrink-0 ${MUTED}`}>
                              {ok} / {t.total} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className={`mb-3 text-sm ${MUTED}`}>
                Questions not yet seen in Test Mode:{" "}
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {currentBank.length - seenCount}
                </span>{" "}
                / {currentBank.length}. The next test uses those first.
                <button
                  onClick={resetTestPool}
                  className="ml-2 font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
                >
                  Reset
                </button>
              </p>

              <div className="mb-6 flex flex-wrap gap-3">
                <button onClick={() => startQuiz("test")} className={BTN_PRIMARY}>
                  New Test (unseen questions)
                </button>
                <button
                  onClick={() => startQuiz("study")}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700"
                >
                  Switch to Study Mode
                </button>
                <button onClick={() => startQuiz("study100")} className={BTN_SOFT}>
                  Study 100 Random
                </button>
              </div>

              <h2 className="mb-4 text-xl font-extrabold">Wrong Answers</h2>

              {wrongAnswers.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Perfect score. No wrong answers.
                </div>
              ) : (
                <div className="space-y-5">
                  {wrongAnswers.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 dark:border-rose-900 dark:bg-rose-950/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-rose-700 dark:text-rose-300">
                          Question {item.questionNumber}
                        </p>
                        {item.tema && (
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-rose-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-rose-900">
                            {item.tema}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-lg font-medium">{item.pregunta}</p>

                      {item.imagen && (
                        <div className="mt-4">
                          <Image
                            src={item.imagen}
                            alt="Question figure"
                            width={800}
                            height={500}
                            className="h-auto w-full rounded-xl border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      )}

                      <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">
                        Your answer: {item.selected}
                      </p>
                      <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Correct answer: {item.correct}
                      </p>

                      {item.explicacion && (
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          Explanation: {item.explicacion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
        {studySheet}
      </div>
    );
  }

  // ---------- quiz screen ----------

  return (
    <div className={PAGE_BG}>
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-3 pb-44 pt-3 sm:px-6 sm:pt-6 lg:pb-10">
        {sidebar}

        <main className="min-w-0 flex-1">
          {mobileHeader}

          <section className={`${CARD} p-4 sm:p-6 lg:p-8`}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                  {modeLabel}
                </p>
                <h1 className="text-xl font-extrabold sm:text-2xl lg:text-3xl">
                  {categoryTitle}
                </h1>
              </div>
              {isStudy ? (
                <p className="text-sm">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {score} ✓
                  </span>
                  <span className={MUTED}> · </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {studyWrong} ✗
                  </span>
                </p>
              ) : (
                <p className={`text-sm ${MUTED}`}>
                  Answered{" "}
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {answeredCount}
                  </span>{" "}
                  / {order.length}
                </p>
              )}
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => setJumpOpen((v) => !v)}
                  className="rounded-lg text-sm font-bold text-slate-800 hover:text-blue-700 dark:text-slate-100"
                  title="Go to a question"
                >
                  Question {current + 1}
                  <span className={`font-medium ${MUTED}`}> / {order.length}</span>
                  <span className={`ml-1 text-xs ${MUTED}`}>▾</span>
                </button>
                {question.tema && (
                  <span className="hidden truncate rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 sm:inline dark:bg-slate-700 dark:text-blue-200">
                    {question.tema}
                  </span>
                )}
              </div>

              {jumpOpen && (
                <form
                  className="mb-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitJump();
                  }}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={order.length}
                    value={jumpTo}
                    autoFocus
                    onChange={(e) => setJumpTo(e.target.value)}
                    placeholder={`1 – ${order.length}`}
                    aria-label="Go to question number"
                    className="w-28 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Go
                  </button>
                </form>
              )}

              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/70 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                  style={{
                    width: `${order.length ? ((current + 1) / order.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <p className="mb-4 rounded-2xl bg-white p-4 text-lg font-semibold leading-relaxed text-slate-900 shadow-sm ring-1 ring-blue-200 sm:mb-6 sm:p-5 sm:text-xl dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600">
              {question.pregunta}
            </p>

            {question.imagen && (
              <div className="mb-5 sm:mb-6">
                <Image
                  src={question.imagen}
                  alt="Question figure"
                  width={800}
                  height={500}
                  className="h-auto w-full rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>
            )}

            <div className="space-y-3">
              {question.opciones?.map((op, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-base text-slate-900 transition active:scale-[0.99] sm:p-4 dark:text-slate-100 ${getOptionClass(i)}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{op}</span>
                </button>
              ))}
            </div>

            {isStudy && showAnswer && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-600 dark:bg-slate-800">
                <p className="text-base font-bold sm:text-lg">
                  {selected === question.correcta ? "✅ Correct" : "❌ Incorrect"}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800 sm:text-base dark:text-slate-200">
                  Correct answer: {question.opciones[question.correcta]}
                </p>
                {question.explicacion && (
                  <p className="mt-2 text-sm text-slate-700 sm:text-base dark:text-slate-300">
                    Explanation: {question.explicacion}
                  </p>
                )}
              </div>
            )}
          </section>

      {/* Bottom bar: fixed on phones, part of the page on desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:static lg:z-auto lg:mt-4">
            <div className="rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(30,58,138,0.25)] ring-1 ring-blue-200 lg:rounded-3xl lg:shadow-xl dark:bg-slate-900 dark:ring-slate-700">
              {isStudy && (
                <div className={`${BRAND} rounded-t-3xl px-3 py-2 lg:rounded-t-3xl`}>
                  <AudioPlayer
                    category={category}
                    order={order}
                    current={current}
                    setCurrent={setCurrent}
                  />
                </div>
              )}

              <div className="relative flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
                <button
                  onClick={prevQuestion}
                  disabled={current === 0}
                  className="h-12 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700"
                >
                  ← Prev
                </button>

                <button
                  onClick={nextQuestion}
                  disabled={current === order.length - 1}
                  className="h-12 flex-1 rounded-xl bg-blue-600 text-base font-bold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-40"
                >
                  Next →
                </button>

                {mode === "test" && (
                  <button
                    onClick={finishTest}
                    className="hidden h-12 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition hover:bg-rose-700 sm:block"
                  >
                    Finish Test
                  </button>
                )}

                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-label="More"
                  className="h-12 w-12 rounded-xl bg-slate-100 text-xl font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
                >
                  ⋯
                </button>

                {moreOpen && (
                  <>
                    <button
                      aria-label="Close menu"
                      onClick={() => setMoreOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute bottom-full right-3 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-900/20 dark:border-slate-700 dark:bg-slate-900">
                      <button
                        onClick={() => {
                          setJumpOpen(true);
                          setMoreOpen(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={MENU_ITEM}
                      >
                        Go to question…
                      </button>
                      {mode === "test" && (
                        <button
                          onClick={finishTest}
                          className={`${MENU_ITEM} font-semibold !text-rose-600 dark:!text-rose-400`}
                        >
                          Finish test
                        </button>
                      )}
                      <button
                        onClick={() => startQuiz(mode, category, 1, topic)}
                        className={MENU_ITEM}
                      >
                        Restart
                      </button>
                      {mode === "test" && (
                        <button onClick={resetTestPool} className={MENU_ITEM}>
                          Reset test pool
                          <span className={`block text-[11px] ${MUTED}`}>
                            {currentBank.length - seenCount} / {currentBank.length} not seen yet
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
      </div>

        </main>
      </div>

      {studySheet}
    </div>
  );
}
