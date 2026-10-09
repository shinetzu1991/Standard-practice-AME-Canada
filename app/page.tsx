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
};

type Category = "standard" | "airframe" | "powerplant";
type QuizMode = "test" | "study" | "study100";

const SHOW_POWERPLANT = true;

const questionBanks: Record<Category, Question[]> = {
  standard: rawStandardQuestions as Question[],
  airframe: rawAirframeQuestions as Question[],
  powerplant: rawPowerplantQuestions as Question[],
};

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const PROGRESS_KEY = "ame-exam-progress";

type SavedProgress = {
  category: Category;
  mode: QuizMode;
  order: Question[];
  current: number;
  selectedAnswers: (number | null)[];
  checkedAnswers: boolean[];
  finished: boolean;
};

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

export default function Home() {
  const [category, setCategory] = useState<Category>("standard");
  const [mode, setMode] = useState<QuizMode>("test");
  const [order, setOrder] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [checkedAnswers, setCheckedAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [studyMenuOpen, setStudyMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [jumpTo, setJumpTo] = useState("");

  const currentBank = questionBanks[category];

  const startQuiz = (
    selectedMode: QuizMode,
    selectedCategory: Category = category,
    initialQuestionNumber = 1,
  ) => {
    const sourceQuestions = questionBanks[selectedCategory];

    const loadedQuestions =
      selectedMode === "test"
        ? shuffleArray(sourceQuestions).slice(
            0,
            Math.min(90, sourceQuestions.length),
          )
        : selectedMode === "study100"
          ? shuffleArray(sourceQuestions).slice(
              0,
              Math.min(100, sourceQuestions.length),
            )
          : [...sourceQuestions];

    const initialCurrent = Math.min(
      Math.max(initialQuestionNumber - 1, 0),
      loadedQuestions.length - 1,
    );

    setMode(selectedMode);
    setOrder(loadedQuestions);
    setCurrent(initialCurrent);
    setSelectedAnswers(new Array(loadedQuestions.length).fill(null));
    setCheckedAnswers(new Array(loadedQuestions.length).fill(false));
    setFinished(false);
    setStudyMenuOpen(false);
  };

  useEffect(() => {
    const saved = loadProgress();

    const params = new URLSearchParams(window.location.search);
    const hasUrlParams =
      params.has("category") || params.has("mode") || params.has("q");
    const urlCategory: Category =
      params.get("category") === "airframe" ? "airframe" : "standard";
    const modeParam = params.get("mode");
    const urlMode: QuizMode =
      modeParam === "study" || modeParam === "study100" ? modeParam : "test";
    const urlQuestionNumber = parseInt(params.get("q") ?? "1", 10);

    const savedMatchesUrl =
      !!saved &&
      (!hasUrlParams ||
        (saved.category === urlCategory && saved.mode === urlMode));

    if (saved && savedMatchesUrl) {
      setCategory(saved.category);
      setMode(saved.mode);
      setOrder(saved.order);
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
      );
    }

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCategory = (newCategory: Category) => {
    setCategory(newCategory);
    startQuiz("test", newCategory);
  };

  useEffect(() => {
    if (!hydrated || order.length === 0) return;

    const data: SavedProgress = {
      category,
      mode,
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
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, [hydrated, category, mode, order, current, selectedAnswers, checkedAnswers, finished]);

  if (order.length === 0 || !order[current]) {
    return <div className="p-6">Loading...</div>;
  }

  const question = order[current];
  const selected = selectedAnswers[current];
  const showAnswer = checkedAnswers[current];

  const score = order.reduce((total, q, index) => {
    return selectedAnswers[index] === q.correcta ? total + 1 : total;
  }, 0);

  const percentage =
    order.length > 0 ? ((score / order.length) * 100).toFixed(1) : "0";

  const wrongAnswers = order
    .map((q, index) => ({
      questionNumber: index + 1,
      pregunta: q.pregunta,
      selected:
        selectedAnswers[index] !== null
          ? q.opciones[selectedAnswers[index] as number]
          : "No answer selected",
      correct: q.opciones[q.correcta],
      explicacion: q.explicacion,
      imagen: q.imagen,
    }))
    .filter((_, index) => selectedAnswers[index] !== order[index].correcta);

  const handleSelect = (index: number) => {
    if (finished) return;
    if ((mode === "study" || mode === "study100") && showAnswer) return;

    const updated = [...selectedAnswers];
    updated[current] = index;
    setSelectedAnswers(updated);

    if (mode === "study" || mode === "study100") {
      const updatedChecked = [...checkedAnswers];
      updatedChecked[current] = true;
      setCheckedAnswers(updatedChecked);
    }
  };

  const nextQuestion = () => {
    if (current < order.length - 1) {
      setCurrent((prev) => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (current > 0) {
      setCurrent((prev) => prev - 1);
    }
  };

  const finishTest = () => {
    setFinished(true);
  };

  const getOptionClass = (i: number) => {
    if (mode === "test" && !finished) {
      return selected === i
        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
        : "border-blue-100 bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50";
    }

    if ((mode === "study" || mode === "study100") && !showAnswer) {
      return selected === i
        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
        : "border-blue-100 bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50";
    }

    if (i === question.correcta) {
      return "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200";
    }

    if (selected === i && i !== question.correcta) {
      return "border-rose-500 bg-rose-50 ring-2 ring-rose-200";
    }

    return "border-blue-100 bg-white";
  };

  const categoryTitle =
    category === "standard"
      ? "STANDARD PRACTICES"
      : category === "airframe"
        ? "AIRFRAME"
        : "POWERPLANT";

  const modeLabel =
    mode === "test"
      ? "TEST MODE"
      : mode === "study100"
        ? "STUDY 100 RANDOM"
        : "STUDY MODE";

  const categoryTabs = (
    <header className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-700 p-5 text-white shadow-xl shadow-blue-900/20 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/25">
          ✈
        </div>
        <div>
          <p className="text-xl font-extrabold tracking-tight">M2 Canada</p>
          <p className="text-xs font-medium uppercase tracking-widest text-blue-200">
            AME exam preparation
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-blue-950/30 p-1.5">
        {(
          [
            ["standard", "Standard Practices"],
            ["airframe", "Airframe"],
            ...(SHOW_POWERPLANT ? [["powerplant", "Powerplant"]] : []),
          ] as [string, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => selectCategory(key as Category)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none sm:px-6 ${
              category === key
                ? "bg-white text-blue-800 shadow-md"
                : "text-blue-100 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );

  if (finished && mode === "test") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-4 py-6 sm:p-8">
        <div className="mx-auto w-full max-w-4xl">
          {categoryTabs}

          <div className="rounded-3xl bg-gradient-to-b from-blue-50 to-sky-100 p-5 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 sm:p-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
            {categoryTitle}
          </p>
          <h1 className="mb-5 text-3xl font-extrabold text-slate-900">
            Test Results
          </h1>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Final Score
              </p>
              <p className="mt-1 text-3xl font-extrabold">
                {score} / {order.length}
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                Percentage
              </p>
              <p className="mt-1 text-3xl font-extrabold text-sky-800">
                {percentage}%
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Incorrect Answers
              </p>
              <p className="mt-1 text-3xl font-extrabold text-rose-700">
                {wrongAnswers.length}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => startQuiz("test")}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700"
            >
              Restart Test Mode
            </button>

            <button
              onClick={() => startQuiz("study")}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700"
            >
              Switch to Study Mode
            </button>

            <button
              onClick={() => startQuiz("study100")}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-50"
            >
              Study 100 Random
            </button>
          </div>

          <h2 className="mb-4 text-xl font-extrabold text-slate-900">Wrong Answers</h2>

          {wrongAnswers.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-700">
              Perfect score. No wrong answers.
            </div>
          ) : (
            <div className="space-y-6">
              {wrongAnswers.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5"
                >
                  <p className="font-bold text-rose-700">
                    Question {item.questionNumber}
                  </p>
                  <p className="mt-2 text-lg font-medium">{item.pregunta}</p>

                  {item.imagen && (
                    <div className="mt-4">
                      <Image
                        src={item.imagen}
                        alt="Question figure"
                        width={800}
                        height={500}
                        className="h-auto w-full rounded-xl border border-slate-200"
                      />
                    </div>
                  )}

                  <p className="mt-3 text-sm font-medium text-rose-700">
                    Your answer: {item.selected}
                  </p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">
                    Correct answer: {item.correct}
                  </p>

                  {item.explicacion && (
                    <p className="mt-2 text-sm text-slate-700">
                      Explanation: {item.explicacion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-4 py-6 sm:p-8">
      <div className="mx-auto w-full max-w-4xl">
        {categoryTabs}

        <div className="rounded-3xl bg-gradient-to-b from-blue-50 to-sky-100 p-5 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 sm:p-8">

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Question bank
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {categoryTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Total questions: {currentBank.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => startQuiz("test")}
              className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                mode === "test"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
              }`}
            >
              Test Mode
            </button>

            <div className="relative">
              <button
                onClick={() => setStudyMenuOpen((prev) => !prev)}
                className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  mode === "study" || mode === "study100"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
                }`}
              >
                Study Mode ▾
              </button>

              {studyMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-900/15">
                  <button
                    onClick={() => startQuiz("study")}
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-blue-50 ${
                      mode === "study"
                        ? "font-semibold text-indigo-700"
                        : "text-slate-700"
                    }`}
                  >
                    Full Question Bank
                  </button>

                  <button
                    onClick={() => startQuiz("study100")}
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-blue-50 ${
                      mode === "study100"
                        ? "font-semibold text-indigo-700"
                        : "text-slate-700"
                    }`}
                  >
                    100 Random Questions
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-slate-800">
                Question {current + 1}{" "}
                <span className="font-medium text-slate-400">
                  / {order.length}
                </span>
              </p>

              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = parseInt(jumpTo, 10);
                  if (Number.isFinite(n)) {
                    setCurrent(Math.min(Math.max(n, 1), order.length) - 1);
                    setJumpTo("");
                  }
                }}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={order.length}
                  value={jumpTo}
                  onChange={(e) => setJumpTo(e.target.value)}
                  placeholder="Go to #"
                  aria-label="Go to question number"
                  className="w-24 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Go
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-blue-700">
                Selected:{" "}
                {selectedAnswers.filter((answer) => answer !== null).length} /{" "}
                {order.length}
              </p>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold tracking-wide text-blue-800">
                {modeLabel}
              </span>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{
                width: `${order.length ? ((current + 1) / order.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {(mode === "study" || mode === "study100") && (
          <AudioPlayer
            category={category}
            order={order}
            current={current}
            setCurrent={setCurrent}
          />
        )}

        <p className="mb-5 rounded-2xl bg-white p-4 text-base font-semibold leading-relaxed text-slate-900 shadow-sm ring-1 ring-blue-200 sm:mb-6 sm:p-5 sm:text-lg">
          {question.pregunta}
        </p>

        {question.imagen && (
          <div className="mb-5 sm:mb-6">
            <Image
              src={question.imagen}
              alt="Question figure"
              width={800}
              height={500}
              className="h-auto w-full rounded-xl border border-slate-200"
            />
          </div>
        )}

        <div className="space-y-3">
          {question.opciones?.map((op, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm text-slate-900 transition sm:p-4 sm:text-base ${getOptionClass(i)}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{op}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={prevQuestion}
            disabled={current === 0}
            className="w-full rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:opacity-40 sm:w-auto sm:text-base"
          >
            Previous
          </button>

          <button
            onClick={nextQuestion}
            disabled={current === order.length - 1}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-40 sm:w-auto sm:text-base"
          >
            Next
          </button>

          {mode === "test" && (
            <button
              onClick={finishTest}
              className="w-full rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition hover:bg-rose-700 sm:w-auto sm:text-base"
            >
              Finish Test
            </button>
          )}

          <button
            onClick={() => startQuiz(mode)}
            className="w-full rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 sm:w-auto sm:text-base"
          >
            Restart
          </button>
        </div>

        {(mode === "study" || mode === "study100") && showAnswer && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-base font-bold text-slate-900 sm:text-lg">
              {selected === question.correcta ? "✅ Correct" : "❌ Incorrect"}
            </p>

            <p className="mt-2 text-sm font-medium text-slate-800 sm:text-base">
              Correct answer: {question.opciones[question.correcta]}
            </p>

            {question.explicacion && (
              <p className="mt-2 text-sm text-slate-700 sm:text-base">
                Explanation: {question.explicacion}
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
