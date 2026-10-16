"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  History,
  SquarePlus,
} from "lucide-react";
import AudioPlayer, { QuestionReader, unlockAudio } from "./AudioPlayer";
import PartnerBadge from "./PartnerBadge";
import ReportButton from "./ReportButton";
import SiteFooter from "./SiteFooter";
import Link from "next/link";
import { signOut } from "./login/actions";
import { authEnabled } from "@/lib/supabase/config";
import { ADMIN_ONLY_CATEGORIES, TOPIC_ORDER, type Category } from "@/lib/sections";
import rawStandardQuestions from "../data/questions.json";
import rawAirframeQuestions from "../data/airframe.json";
import rawPowerplantQuestions from "../data/powerplant.json";
import rawPowerplantVerified from "../data/powerplant_verified.json";

type Question = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  imagen?: string;
  tema?: string;
};

// "lazy" = Paul's Lazy Mode: whole bank, question + correct answer only.
type QuizMode = "test" | "study" | "study100" | "topic" | "lazy";

const SHOW_POWERPLANT = true;

const CATEGORIES: { key: Category; label: string; short: string }[] = [
  { key: "standard", label: "Standard Practices", short: "Standard" },
  { key: "airframe", label: "Airframe", short: "Airframe" },
  ...(SHOW_POWERPLANT
    ? [{ key: "powerplant" as Category, label: "Powerplant", short: "Powerplant" }]
    : []),
  { key: "powerplant_verified", label: "Powerplant Verified", short: "PP Verified" },
];

// Each section gets its own icon and colour so the three are easy to tell apart.
const SECTION_STYLE: Record<
  Category,
  { image: string; active: string; idle: string; badge: string }
> = {
  standard: {
    image: "/icons/section-standard.png",
    active: "bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-violet-600",
    idle: "text-violet-700 ring-violet-200 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-900 dark:hover:bg-violet-950/40",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  airframe: {
    image: "/icons/section-airframe.png",
    active: "bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-sky-600",
    idle: "text-sky-700 ring-sky-200 hover:bg-sky-50 dark:text-sky-300 dark:ring-sky-900 dark:hover:bg-sky-950/40",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  powerplant: {
    image: "/icons/section-powerplant.png",
    active: "bg-orange-600 text-white shadow-lg shadow-orange-600/30 ring-orange-600",
    idle: "text-orange-700 ring-orange-200 hover:bg-orange-50 dark:text-orange-300 dark:ring-orange-900 dark:hover:bg-orange-950/40",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  powerplant_verified: {
    image: "/icons/section-powerplant.png",
    active: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-emerald-600",
    idle: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:ring-emerald-900 dark:hover:bg-emerald-950/40",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};


const questionBanks: Record<Category, Question[]> = {
  standard: rawStandardQuestions as Question[],
  airframe: rawAirframeQuestions as Question[],
  powerplant: rawPowerplantQuestions as Question[],
  // Review bank: the Powerplant questions whose answer the Jeppesen textbook
  // confirms. Admin only; it reuses the Powerplant audio clips.
  powerplant_verified: rawPowerplantVerified as Question[],
};

// Audio folder for a section (the verified bank shares Powerplant's clips).
const audioCategory = (c: Category) => (c === "powerplant_verified" ? "powerplant" : c);

// Live banks: the JSON files above minus questions hidden from /admin, plus
// approved user submissions. Filled once by loadBankUpdates() at start-up.
let liveBanks: Record<Category, Question[]> = questionBanks;

type BankUpdates = {
  hidden: { category: Category; question: string }[];
  added: (Question & { category: Category })[];
};

async function loadBankUpdates(): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch("/api/bank-updates", { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return;
    const u = (await res.json()) as BankUpdates;
    const hidden = new Set(u.hidden.map((h) => h.question));
    const next = { ...questionBanks };
    for (const c of Object.keys(next) as Category[]) {
      const base = questionBanks[c].filter((q) => !hidden.has(q.pregunta));
      const known = new Set(base.map((q) => q.pregunta));
      const added: Question[] = u.added
        .filter((a) => a.category === c && !hidden.has(a.pregunta) && !known.has(a.pregunta))
        .map((a) => ({
          pregunta: a.pregunta,
          opciones: a.opciones,
          correcta: a.correcta,
          tema: a.tema,
          explicacion: a.explicacion,
        }));
      next[c] = [...base, ...added];
    }
    liveBanks = next;
  } catch {
    // offline or slow: keep the built-in banks
  } finally {
    clearTimeout(timer);
  }
}

function topicsFor(category: Category): { name: string; count: number }[] {
  const bank = liveBanks[category];
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
  testStartedAt?: number | null;
  testFinishedAt?: number | null;
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

// Finished tests, kept on this device so the average per section can be shown.
const HISTORY_KEY = "ame-test-history";
type TestRecord = {
  startedAt: number; // also the record id
  finishedAt: number;
  category: Category;
  score: number;
  total: number;
  // Questions answered wrong (or left blank), with the option picked; older
  // records saved before this field existed don't have it.
  wrong?: { q: string; sel: number | null }[];
};

const PASS_PCT = 70; // Transport Canada pass mark

// Explanations are hidden for now; set to true to show them again under the
// answers (study mode, results and test history).
const SHOW_EXPLANATIONS = false;

// Study mode: delay before moving on after a correct answer.
const STUDY_AUTO_NEXT_MS = 3000;

function recordPct(r: TestRecord): number {
  return r.total > 0 ? (r.score / r.total) * 100 : 0;
}

function loadHistory(): TestRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as TestRecord[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: TestRecord[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

const READ_ALOUD_KEY = "ame-test-read-aloud";
const TEST_SIZE = 90;
const TEST_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours, like the Transport Canada exam

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

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

export default function Home({ isAdmin = false }: { isAdmin?: boolean }) {
  const visibleCategories = CATEGORIES.filter((c) => isAdmin || !ADMIN_ONLY_CATEGORIES.has(c.key));
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
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);
  const [testFinishedAt, setTestFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [readAloud, setReadAloud] = useState(false);
  const [history, setHistory] = useState<TestRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<number | null>(null); // startedAt of the test shown
  const autoNextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentBank = liveBanks[category];

  const startQuiz = (
    selectedMode: QuizMode,
    selectedCategory: Category = category,
    initialQuestionNumber = 1,
    selectedTopic: string | null = null,
  ) => {
    const bank = liveBanks[selectedCategory];
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
    setTestStartedAt(null); // test mode waits for the Start button
    setTestFinishedAt(null);
    setStudyMenuOpen(false);
    setMoreOpen(false);
    setJumpOpen(false);
    setHistoryOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    loadBankUpdates().finally(() => {
      if (!cancelled) init();
    });
    return () => {
      cancelled = true;
    };

    function init() {
    const saved = loadProgress();

    const params = new URLSearchParams(window.location.search);
    const hasUrlParams =
      params.has("category") || params.has("mode") || params.has("q");
    const categoryParam = params.get("category");
    const urlCategory: Category =
      categoryParam === "airframe" || categoryParam === "powerplant" || categoryParam === "powerplant_verified"
        ? categoryParam
        : "standard";
    const modeParam = params.get("mode");
    const urlTopic = params.get("topic");
    const urlMode: QuizMode =
      modeParam === "study" || modeParam === "study100" || modeParam === "lazy"
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
        liveBanks[saved.category].map((q) => [q.pregunta, q] as const),
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
      setTestStartedAt(saved.testStartedAt ?? null);
      setTestFinishedAt(saved.testFinishedAt ?? null);
      if (
        saved.mode === "test" &&
        !saved.finished &&
        saved.testStartedAt &&
        Date.now() - saved.testStartedAt >= TEST_DURATION_MS
      ) {
        setFinished(true);
        setTestFinishedAt(saved.testStartedAt + TEST_DURATION_MS);
      }
    } else {
      setCategory(urlCategory);
      startQuiz(
        urlMode,
        urlCategory,
        Number.isFinite(urlQuestionNumber) ? urlQuestionNumber : 1,
        urlTopic,
      );
    }

    try {
      setReadAloud(localStorage.getItem(READ_ALOUD_KEY) === "1");
    } catch {
      // ignore
    }

    setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleReadAloud = () => {
    const next = !readAloud;
    if (next) unlockAudio(); // inside the tap, so iPhone allows later autoplay
    setReadAloud(next);
    try {
      localStorage.setItem(READ_ALOUD_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  // Keep the "not seen yet in Test Mode" counter in sync with storage.
  useEffect(() => {
    if (!hydrated) return;
    const bank = liveBanks[category];
    const seen = new Set(loadSeen()[category] ?? []);
    setSeenCount(bank.filter((q) => seen.has(q.pregunta)).length);
  }, [hydrated, category, order, selectedAnswers]);

  // Record each finished test once (keyed by its start time). Tests finished
  // with no answers at all are skipped so they don't drag the average down.
  useEffect(() => {
    if (!hydrated) return;
    const list = loadHistory();
    if (
      mode === "test" &&
      finished &&
      testStartedAt !== null &&
      selectedAnswers.some((a) => a !== null) &&
      !list.some((r) => r.startedAt === testStartedAt)
    ) {
      const score = order.reduce(
        (total, q, i) => (selectedAnswers[i] === q.correcta ? total + 1 : total),
        0,
      );
      list.push({
        startedAt: testStartedAt,
        finishedAt: testFinishedAt ?? Date.now(),
        category,
        score,
        total: order.length,
        wrong: order
          .map((q, i) => ({ q: q.pregunta, sel: selectedAnswers[i], ok: selectedAnswers[i] === q.correcta }))
          .filter((w) => !w.ok)
          .map(({ q, sel }) => ({ q, sel })),
      });
      saveHistory(list);
    }
    setHistory(list);
  }, [hydrated, mode, finished, testStartedAt, testFinishedAt, selectedAnswers, order, category]);

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
      testStartedAt,
      testFinishedAt,
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
  }, [hydrated, category, mode, topic, order, current, selectedAnswers, checkedAnswers, finished, testStartedAt, testFinishedAt]);

  // Exam clock: tick every second while a test is running; finish when time is up.
  const testRunning = mode === "test" && !finished && testStartedAt !== null;
  useEffect(() => {
    if (!testRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [testRunning]);

  const timeLeftMs = testStartedAt
    ? Math.max(0, testStartedAt + TEST_DURATION_MS - now)
    : TEST_DURATION_MS;

  useEffect(() => {
    if (testRunning && timeLeftMs <= 0) {
      setFinished(true);
      setTestFinishedAt(Date.now());
    }
  }, [testRunning, timeLeftMs]);

  const beginTest = () => {
    setTestStartedAt(Date.now());
    setNow(Date.now());
  };

  const question = order[current];
  const isLazy = mode === "lazy";
  const isStudy = mode === "study" || mode === "study100" || mode === "topic" || isLazy;
  const selected = selectedAnswers[current] ?? null;
  const showAnswer = checkedAnswers[current] ?? false;

  const handleSelect = (index: number) => {
    if (!question || finished) return;
    if (mode === "test" && testStartedAt === null) return;
    if (isLazy || (isStudy && showAnswer)) return;

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

      // Correct answer in study mode: move on by itself after a pause long
      // enough to see it was right (a wrong answer stays on screen).
      if (index === question.correcta && current < order.length - 1) {
        if (autoNextRef.current) clearTimeout(autoNextRef.current);
        autoNextRef.current = setTimeout(() => {
          autoNextRef.current = null;
          setCurrent((prev) => Math.min(prev + 1, order.length - 1));
        }, STUDY_AUTO_NEXT_MS);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (autoNextRef.current) clearTimeout(autoNextRef.current);
      autoNextRef.current = null;
    };
  }, [current]);

  const nextQuestion = () => {
    setCurrent((prev) => Math.min(prev + 1, order.length - 1));
  };

  const prevQuestion = () => {
    setCurrent((prev) => Math.max(prev - 1, 0));
  };

  const finishTest = () => {
    setFinished(true);
    setTestFinishedAt(Date.now());
    setMoreOpen(false);
  };

  const awaitingStart = mode === "test" && !finished && testStartedAt === null;

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
      if (mode === "test" && testStartedAt === null) return;
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
  }, [question, finished, isStudy, showAnswer, selectedAnswers, checkedAnswers, current, order.length, mode, testStartedAt]);

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
      : mode === "lazy"
        ? "Paul's Lazy Mode"
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

  // ---------- test history (this device) ----------

  const sectionHistory = history
    .filter((r) => r.category === category)
    .sort((a, b) => b.finishedAt - a.finishedAt);
  const averagePct =
    sectionHistory.length > 0
      ? sectionHistory.reduce((sum, r) => sum + recordPct(r), 0) / sectionHistory.length
      : 0;
  const bestPct = sectionHistory.reduce((best, r) => Math.max(best, recordPct(r)), 0);
  const passedCount = sectionHistory.filter((r) => recordPct(r) >= PASS_PCT).length;

  const formatDay = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const formatDayTime = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const pctText = (pct: number) =>
    pct >= PASS_PCT ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  const passBadge = (pct: number, large = false) => {
    const passed = pct >= PASS_PCT;
    const Icon = passed ? CircleCheck : CircleX;
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ${
          large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"
        } ${
          passed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        }`}
      >
        <Icon className={large ? "h-4 w-4" : "h-3 w-3"} />
        {passed ? "Passed" : "Failed"}
      </span>
    );
  };

  const historyStats = (
    <div className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
      <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-slate-900">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}>Average</p>
        <p className={`text-2xl font-extrabold ${pctText(averagePct)}`}>{averagePct.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-slate-900">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}>Best</p>
        <p className={`text-2xl font-extrabold ${pctText(bestPct)}`}>{bestPct.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-slate-900">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}>Tests</p>
        <p className="text-2xl font-extrabold">{sectionHistory.length}</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-slate-900">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}>Passed</p>
        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
          {passedCount}
        </p>
      </div>
    </div>
  );

  const historyList = (limit?: number) => (
    <ul className="divide-y divide-blue-100 text-sm dark:divide-slate-700">
      {sectionHistory.slice(0, limit).map((r) => {
        const pct = recordPct(r);
        return (
          <li key={r.startedAt}>
            <button
              onClick={() => openHistory(r.startedAt)}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-blue-50 dark:hover:bg-slate-700/50"
            >
              <span className={`min-w-0 flex-1 ${MUTED}`}>{formatDay(r.finishedAt)}</span>
              <span className="tabular-nums">
                {r.score} / {r.total} ·{" "}
                <span className={`font-bold ${pctText(pct)}`}>{pct.toFixed(1)}%</span>
              </span>
              {passBadge(pct)}
              <ChevronRight className={`h-4 w-4 shrink-0 ${MUTED}`} />
            </button>
          </li>
        );
      })}
    </ul>
  );

  // Summary on the Test Mode start and results screens; the full list and each
  // test's wrong answers live in the Test history view.
  const historyPanel =
    sectionHistory.length === 0 ? null : (
      <div className="mb-6 rounded-2xl bg-white p-4 text-left ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Your tests · {categoryTitle}
          </h2>
          <button
            onClick={() => openHistory()}
            className="text-sm font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
          >
            View history
          </button>
        </div>
        {historyStats}
        {historyList(5)}
      </div>
    );

  type WrongItem = {
    category?: Category;
    questionNumber?: number;
    pregunta: string;
    tema?: string;
    selected: string;
    correct: string;
    explicacion?: string;
    imagen?: string;
  };

  const wrongAnswerCard = (item: WrongItem, index: number) => (
    <div
      key={index}
      className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 dark:border-rose-900 dark:bg-rose-950/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-rose-700 dark:text-rose-300">
          Question {item.questionNumber ?? index + 1}
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

      {SHOW_EXPLANATIONS && item.explicacion && (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Explanation: {item.explicacion}
        </p>
      )}
      <div className="mt-3">
        <ReportButton category={item.category ?? category} question={item.pregunta} />
      </div>
    </div>
  );

  const detailRecord =
    historyDetail !== null ? history.find((r) => r.startedAt === historyDetail) : undefined;

  const detailWrong: WrongItem[] | undefined = detailRecord?.wrong?.map((w) => {
    const q = [...liveBanks[detailRecord.category], ...questionBanks[detailRecord.category]].find(
      (b) => b.pregunta === w.q,
    );
    return {
      category: detailRecord.category,
      pregunta: w.q,
      tema: q?.tema,
      selected:
        w.sel === null ? "No answer selected" : (q?.opciones[w.sel] ?? "—"),
      correct: q ? q.opciones[q.correcta] : "—",
      explicacion: q?.explicacion,
      imagen: q?.imagen,
    };
  });

  const historyView = (
    <section className={`${CARD} p-5 sm:p-8`}>
      {detailRecord ? (
        <>
          <button
            onClick={() => setHistoryDetail(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
          >
            <ChevronLeft className="h-4 w-4" />
            All tests
          </button>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            {CATEGORIES.find((c) => c.key === detailRecord.category)?.label.toUpperCase()}
          </p>
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold">Test results</h1>
            {passBadge(recordPct(detailRecord), true)}
          </div>
          <p className={`mb-5 text-sm ${MUTED}`}>
            {formatDayTime(detailRecord.finishedAt)} · time used{" "}
            <span className="font-mono font-semibold tabular-nums">
              {formatClock(Math.min(detailRecord.finishedAt - detailRecord.startedAt, TEST_DURATION_MS))}
            </span>
          </p>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div
              className={`rounded-2xl p-4 text-white shadow-md ${
                recordPct(detailRecord) >= PASS_PCT
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  : "bg-gradient-to-br from-rose-500 to-rose-600"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Score</p>
              <p className="mt-1 text-3xl font-extrabold">
                {detailRecord.score} / {detailRecord.total}
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200 dark:bg-slate-800 dark:ring-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                Percentage
              </p>
              <p className={`mt-1 text-3xl font-extrabold ${pctText(recordPct(detailRecord))}`}>
                {recordPct(detailRecord).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Incorrect answers
              </p>
              <p className="mt-1 text-3xl font-extrabold text-rose-700 dark:text-rose-300">
                {detailRecord.total - detailRecord.score}
              </p>
            </div>
          </div>

          <h2 className="mb-4 text-xl font-extrabold">Wrong answers</h2>
          {detailWrong === undefined ? (
            <p className={`rounded-2xl bg-blue-50 p-4 text-sm ${MUTED} dark:bg-slate-800`}>
              This test was taken before wrong answers were saved, so only the score is
              available.
            </p>
          ) : detailWrong.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Perfect score. No wrong answers.
            </div>
          ) : (
            <div className="space-y-5">{detailWrong.map(wrongAnswerCard)}</div>
          )}
        </>
      ) : (
        <>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            {categoryTitle}
          </p>
          <h1 className="mb-1 text-3xl font-extrabold">Test history</h1>
          <p className={`mb-5 text-sm ${MUTED}`}>
            Tests finished on this device. Pass mark: {PASS_PCT}%. Open a test to see the
            questions you got wrong.
          </p>
          {sectionHistory.length === 0 ? (
            <div className="rounded-2xl bg-blue-50 p-5 text-center dark:bg-slate-800">
              <p className="mb-4 font-medium">No tests finished in this section yet.</p>
              <button onClick={() => startQuiz("test")} className={BTN_PRIMARY}>
                Start a test
              </button>
            </div>
          ) : (
            <>
              {historyStats}
              {historyList()}
            </>
          )}
        </>
      )}
    </section>
  );

  const openHistory = (detail: number | null = null) => {
    setHistoryOpen(true);
    setHistoryDetail(detail);
    setStudyMenuOpen(false);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  const studyModeChoices = (
    <>
      <button
        onClick={() => startQuiz("study")}
        className={!historyOpen && mode === "study" ? MENU_ITEM_ACTIVE : MENU_ITEM}
      >
        Full question bank
        <span className={`ml-2 text-xs ${MUTED}`}>{currentBank.length}</span>
      </button>
      <button
        onClick={() => startQuiz("study100")}
        className={!historyOpen && mode === "study100" ? MENU_ITEM_ACTIVE : MENU_ITEM}
      >
        100 random questions
      </button>
      <button
        onClick={() => startQuiz("lazy")}
        className={!historyOpen && mode === "lazy" ? MENU_ITEM_ACTIVE : MENU_ITEM}
      >
        Paul&apos;s Lazy Mode
        <span className={`ml-2 text-xs ${MUTED}`}>answers only</span>
      </button>
    </>
  );

  const topicChoices = topicsFor(category).map((t) => (
    <button
      key={t.name}
      onClick={() => startQuiz("topic", category, 1, t.name)}
      className={`${
        !historyOpen && mode === "topic" && topic === t.name ? MENU_ITEM_ACTIVE : MENU_ITEM
      } flex items-center justify-between gap-2 !py-2.5`}
    >
      <span>{t.name}</span>
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-slate-700 dark:text-blue-200">
        {t.count}
      </span>
    </button>
  ));

  // Phones: the study sheet lists the study modes and the topics together.
  const studyChoices = (
    <>
      {studyModeChoices}
      <p className="border-t border-blue-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:border-slate-700 dark:text-blue-300">
        By topic
      </p>
      {topicChoices}
    </>
  );

  // The three sections, each with its own icon and colour.
  const sectionTabs = (compact: boolean) => (
    <nav
      aria-label="Section"
      className={`grid gap-2 ${visibleCategories.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}
    >
      {visibleCategories.map((c) => {
        const style = SECTION_STYLE[c.key];
        const on = category === c.key;
        return (
          <button
            key={c.key}
            onClick={() => selectCategory(c.key)}
            aria-current={on ? "page" : undefined}
            className={`flex items-center rounded-2xl ring-1 transition ${
              compact
                ? "flex-col justify-center gap-1 px-1 py-2 text-center"
                : "gap-3 px-4 py-3 text-left"
            } ${on ? style.active : `bg-white dark:bg-slate-900 ${style.idle}`}`}
          >
            <Image
              src={style.image}
              alt=""
              width={compact ? 40 : 52}
              height={compact ? 40 : 52}
              className={`shrink-0 rounded-xl ${compact ? "h-10 w-10" : "h-13 w-13"}`}
            />
            <span className="min-w-0">
              <span
                className={`block font-extrabold leading-tight ${compact ? "text-[11px]" : "text-base"}`}
              >
                {compact ? c.short : c.label}
              </span>
              {!compact && (
                <span className={`block text-xs ${on ? "text-white/80" : MUTED}`}>
                  {liveBanks[c.key].length} questions
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );

  const topBar = (
    <header className="mb-5 hidden lg:block">
      <div
        className={`${BRAND} mb-3 flex items-center justify-between gap-4 rounded-2xl px-5 py-3 shadow-xl shadow-blue-900/20`}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/icons/icon-192.png"
            alt="M2 Canada logo"
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-xl"
          />
          <div>
            <p className="text-xl font-extrabold tracking-tight">M2 Canada</p>
            <p className="text-[11px] font-medium uppercase tracking-widest text-blue-200">
              AME exam preparation
            </p>
          </div>
        </div>
        {authEnabled && (
          <form action={signOut}>
            <button className="text-xs font-semibold text-blue-200 underline-offset-2 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        )}
      </div>
      {sectionTabs(false)}
    </header>
  );

  const rightSidebar = (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-6 space-y-4">
        <div className={`${SIDE_CARD} !p-0`}>
          <p className="px-4 pt-4 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Mode
          </p>
          <div className="py-2">
            <button
              onClick={() => startQuiz("test")}
              className={!historyOpen && mode === "test" ? MENU_ITEM_ACTIVE : MENU_ITEM}
            >
              Test mode
              <span className={`ml-2 text-xs ${MUTED}`}>90 questions</span>
            </button>
            {studyModeChoices}
            <button
              onClick={() => openHistory()}
              className={`${historyOpen ? MENU_ITEM_ACTIVE : MENU_ITEM} flex items-center gap-2 border-t border-blue-100 dark:border-slate-700`}
            >
              <History className="h-4 w-4" />
              Test history
              <span className={`ml-auto text-xs ${MUTED}`}>{sectionHistory.length}</span>
            </button>
            <Link href="/submit" className={`${MENU_ITEM} flex items-center gap-2`}>
              <SquarePlus className="h-4 w-4" />
              Suggest a question
            </Link>
          </div>
        </div>

        <div className={`${SIDE_CARD} !p-0`}>
          <p className="px-4 pt-4 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Study by topic
          </p>
          <div className="max-h-[45vh] overflow-y-auto py-2">{topicChoices}</div>
        </div>

        {!historyOpen && (
        <div className={SIDE_CARD}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Progress
          </p>
          <p className="text-sm font-semibold">
            Question {current + 1}
            <span className={`font-medium ${MUTED}`}> / {order.length}</span>
          </p>
          {isLazy ? null : isStudy ? (
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
              {testRunning && (
                <span className="ml-2 font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                  ⏱ {formatClock(timeLeftMs)}
                </span>
              )}
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
        )}

        <PartnerBadge />
      </div>
    </aside>
  );

  const mobileHeader = (
    <header
      className={`${BRAND} mb-3 rounded-2xl p-3 shadow-lg shadow-blue-900/20 lg:hidden`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Image
            src="/icons/icon-192.png"
            alt="M2 Canada logo"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-lg"
          />
          <span className="text-base font-extrabold tracking-tight">M2 Canada</span>
        </div>
        <div className="flex gap-1 rounded-xl bg-blue-950/40 p-1">
          <button
            onClick={() => startQuiz("test")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !historyOpen && mode === "test" ? "bg-white text-blue-800 shadow" : "text-blue-100"
            }`}
          >
            Test
          </button>
          <button
            onClick={() => setStudyMenuOpen(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !historyOpen && isStudy ? "bg-white text-blue-800 shadow" : "text-blue-100"
            }`}
          >
            Study ▾
          </button>
          <button
            onClick={() => openHistory()}
            aria-label="Test history"
            className={`rounded-lg px-2.5 py-1.5 transition ${
              historyOpen ? "bg-white text-blue-800 shadow" : "text-blue-100"
            }`}
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      </div>
      {sectionTabs(true)}
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
        {authEnabled && (
          <form action={signOut} className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button className={`text-sm font-semibold ${MUTED}`}>Sign out</button>
          </form>
        )}
      </div>
    </div>
  );

  // ---------- test history screen ----------

  if (historyOpen) {
    return (
      <div className={PAGE_BG}>
        <div className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-6 sm:pt-6">
          {topBar}
          {mobileHeader}
          <div className="flex gap-6">
            <main className="min-w-0 flex-1">{historyView}</main>
            {rightSidebar}
          </div>
          <PartnerBadge className="mt-4 lg:hidden" />
          <SiteFooter />
        </div>
        {studySheet}
      </div>
    );
  }

  // ---------- results screen ----------

  const passed = Number(percentage) >= PASS_PCT;

  if (finished && mode === "test") {
    return (
      <div className={PAGE_BG}>
        <div className="mx-auto w-full max-w-6xl px-3 pb-10 pt-3 sm:px-6 sm:pt-6">
          {topBar}
          {mobileHeader}
          <div className="flex gap-6">
          <main className="min-w-0 flex-1">
            <div className={`${CARD} p-5 sm:p-8`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                {categoryTitle}
              </p>
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold">Test Results</h1>
                {passBadge(Number(percentage), true)}
              </div>
              {testStartedAt && (
                <p className={`mb-5 text-sm ${MUTED}`}>
                  Time used:{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatClock(
                      Math.min(
                        (testFinishedAt ?? Date.now()) - testStartedAt,
                        TEST_DURATION_MS,
                      ),
                    )}
                  </span>{" "}
                  of {formatClock(TEST_DURATION_MS)}
                  {timeLeftMs <= 0 && " · time expired"}
                </p>
              )}

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div
                  className={`rounded-2xl p-4 text-white shadow-md ${
                    passed
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                      : "bg-gradient-to-br from-rose-500 to-rose-600"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                    Final Score · {passed ? "Passed" : "Failed"}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold">
                    {score} / {order.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200 dark:bg-slate-800 dark:ring-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    Percentage · pass mark {PASS_PCT}%
                  </p>
                  <p className={`mt-1 text-3xl font-extrabold ${pctText(Number(percentage))}`}>
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

              {historyPanel}

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
                  {wrongAnswers.map(wrongAnswerCard)}
                </div>
              )}
            </div>
          </main>
          {rightSidebar}
          </div>
          <PartnerBadge className="mt-4 lg:hidden" />
          <SiteFooter />
        </div>
        {studySheet}
      </div>
    );
  }

  // ---------- quiz screen ----------

  return (
    <div className={PAGE_BG}>
      <div className="mx-auto w-full max-w-6xl px-3 pb-44 pt-3 sm:px-6 sm:pt-6 lg:pb-10">
        {topBar}
        {mobileHeader}
        <div className="flex gap-6">
        <main className="min-w-0 flex-1">
          {awaitingStart ? (
            <section className={`${CARD} p-6 sm:p-10`}>
              <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-3xl text-white shadow-lg shadow-blue-600/30">
                  ⏱
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                  {categoryTitle}
                </p>
                <h1 className="mt-1 text-3xl font-extrabold">Test Mode</h1>
                <p className="mt-4 text-lg font-medium">
                  Complete the {order.length} questions of this section.
                </p>
                <p className="mt-2 text-lg">
                  You have{" "}
                  <span className="font-mono font-bold tabular-nums">
                    {formatClock(TEST_DURATION_MS)}
                  </span>{" "}
                  after you hit Start.
                </p>
                <ul className={`mt-5 space-y-1 text-sm ${MUTED}`}>
                  <li>The answers are shown at the end of the test.</li>
                  <li>The test ends by itself when the time is up; you can also finish earlier.</li>
                  <li>
                    {currentBank.length - seenCount} of {currentBank.length} questions
                    in this section have not been in a test yet.
                  </li>
                </ul>
                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600">
                  <input
                    type="checkbox"
                    checked={readAloud}
                    onChange={toggleReadAloud}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Read each question aloud (question only, no answer)
                </label>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    onClick={beginTest}
                    className="rounded-xl bg-blue-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
                  >
                    Start
                  </button>
                  <button onClick={() => startQuiz("study")} className={BTN_SOFT}>
                    Study instead
                  </button>
                </div>
                {historyPanel && <div className="mt-8">{historyPanel}</div>}
              </div>
            </section>
          ) : (
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
              {isLazy ? (
                <p className={`text-sm ${MUTED}`}>Question and answer only</p>
              ) : isStudy ? (
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
                <div className="flex items-center gap-3">
                  <p className={`text-sm ${MUTED}`}>
                    Answered{" "}
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {answeredCount}
                    </span>{" "}
                    / {order.length}
                  </p>
                  <button
                    onClick={toggleReadAloud}
                    aria-pressed={readAloud}
                    title="Read each question aloud (question only)"
                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 transition ${
                      readAloud
                        ? "bg-indigo-600 text-white ring-indigo-600 shadow-md shadow-indigo-600/30"
                        : "bg-white text-slate-600 ring-blue-200 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
                    }`}
                  >
                    {readAloud ? "🔊 Reading" : "🔈 Read aloud"}
                  </button>
                  <span
                    className={`rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums ring-1 ${
                      timeLeftMs < 10 * 60 * 1000
                        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800"
                        : "bg-white text-blue-800 ring-blue-200 dark:bg-slate-800 dark:text-blue-200 dark:ring-slate-600"
                    }`}
                    title="Time left"
                  >
                    ⏱ {formatClock(timeLeftMs)}
                  </span>
                </div>
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

            {testRunning && (
              <QuestionReader
                category={audioCategory(category)}
                question={question}
                enabled={readAloud}
              />
            )}

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

            {isLazy ? (
              <div className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4 shadow-sm ring-2 ring-emerald-200 sm:p-5 dark:border-emerald-700 dark:bg-emerald-950/50 dark:ring-emerald-900">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                  Answer
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-900 sm:text-xl dark:text-emerald-100">
                  {question.opciones[question.correcta]}
                </p>
                <div className="mt-3">
                  <ReportButton category={category} question={question.pregunta} />
                </div>
              </div>
            ) : (
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
            )}

            {isStudy && !isLazy && showAnswer && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-600 dark:bg-slate-800">
                <p className="text-base font-bold sm:text-lg">
                  {selected === question.correcta ? "✅ Correct" : "❌ Incorrect"}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800 sm:text-base dark:text-slate-200">
                  Correct answer: {question.opciones[question.correcta]}
                </p>
                {SHOW_EXPLANATIONS && question.explicacion && (
                  <p className="mt-2 text-sm text-slate-700 sm:text-base dark:text-slate-300">
                    Explanation: {question.explicacion}
                  </p>
                )}
                <div className="mt-3">
                  <ReportButton category={category} question={question.pregunta} />
                </div>
              </div>
            )}
          </section>
          )}

      {/* Bottom bar: fixed on phones, part of the page on desktop. */}
      {!awaitingStart && (
      <div className="fixed inset-x-0 bottom-0 z-30 lg:static lg:z-auto lg:mt-4">
            <div className="rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(30,58,138,0.25)] ring-1 ring-blue-200 lg:rounded-3xl lg:shadow-xl dark:bg-slate-900 dark:ring-slate-700">
              {isStudy && (
                <div className={`${BRAND} rounded-t-3xl px-3 py-2 lg:rounded-t-3xl`}>
                  <AudioPlayer
                    category={audioCategory(category)}
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
      )}

        </main>
        {rightSidebar}
        </div>
        <PartnerBadge className="mt-4 lg:hidden" />
        <SiteFooter />
      </div>

      {studySheet}
    </div>
  );
}
