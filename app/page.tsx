"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import rawQuestions from "../data/questions.json";

type Question = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  imagen?: string;
};

const questions = rawQuestions as Question[];

const preguntasTexto = questions.map((q) => q.pregunta);
const duplicadas = preguntasTexto.filter(
  (item, index) => preguntasTexto.indexOf(item) !== index
);
console.log("Duplicadas:", duplicadas);

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export default function Home() {
  const [mode, setMode] = useState<"test" | "study">("test");
  const [order, setOrder] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [checkedAnswers, setCheckedAnswers] = useState<boolean[]>([]);
  const [score, setScore] = useState(0);

  const startQuiz = (selectedMode: "test" | "study") => {
    const loadedQuestions =
      selectedMode === "test"
        ? shuffleArray(questions).slice(0, 90)
        : [...questions];

    setMode(selectedMode);
    setOrder(loadedQuestions);
    setCurrent(0);
    setSelectedAnswers(new Array(loadedQuestions.length).fill(null));
    setCheckedAnswers(new Array(loadedQuestions.length).fill(false));
    setScore(0);
  };

  useEffect(() => {
    startQuiz("test");
  }, []);

  if (order.length === 0 || !order[current]) {
    return <div className="p-6">Loading...</div>;
  }

  const question = order[current];
  const selected = selectedAnswers[current];
  const showAnswer = checkedAnswers[current];

  const handleSelect = (index: number) => {
    if (showAnswer && mode === "test") return;

    const updated = [...selectedAnswers];
    updated[current] = index;
    setSelectedAnswers(updated);
  };

  const handleCheck = () => {
    if (selected === null) return;
    if (mode === "test" && showAnswer) return;

    const updatedChecked = [...checkedAnswers];
    const wasAlreadyChecked = updatedChecked[current];
    updatedChecked[current] = true;
    setCheckedAnswers(updatedChecked);

    if (!wasAlreadyChecked && selected === question.correcta) {
      setScore((prev) => prev + 1);
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

  const getOptionClass = (i: number) => {
    if (!showAnswer) {
      return selected === i
        ? "border-blue-500 bg-blue-100"
        : "border-gray-300 bg-white hover:bg-gray-50";
    }

    if (i === question.correcta) {
      return "border-green-500 bg-green-100";
    }

    if (selected === i && i !== question.correcta) {
      return "border-red-500 bg-red-100";
    }

    return "border-gray-300 bg-white";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-3xl font-bold">STANDARD PRACTICES AME CANADA</h1>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => startQuiz("test")}
            className={`rounded-lg px-5 py-3 text-white ${
              mode === "test" ? "bg-blue-700" : "bg-blue-600"
            }`}
          >
            Test Mode (90 Questions)
          </button>

          <button
            onClick={() => startQuiz("study")}
            className={`rounded-lg px-5 py-3 text-white ${
              mode === "study" ? "bg-green-700" : "bg-green-600"
            }`}
          >
            Study Mode (All Questions)
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            Question {current + 1} / {order.length}
          </p>

          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-blue-600">
              Score: {score} / {order.length}
            </p>
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
              {mode === "test" ? "TEST MODE" : "STUDY MODE"}
            </span>
          </div>
        </div>

        <p className="mb-6 text-lg font-medium">{question.pregunta}</p>

        {question.imagen && (
          <div className="mb-6">
            <Image
              src={question.imagen}
              alt="Question figure"
              width={800}
              height={500}
              className="h-auto w-full rounded-lg border"
            />
          </div>
        )}

        <div className="space-y-3">
          {question.opciones?.map((op, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full rounded-lg border p-4 text-left transition ${getOptionClass(i)}`}
            >
              {op}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleCheck}
            disabled={selected === null || (mode === "test" && showAnswer)}
            className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50"
          >
            Check Answer
          </button>

          <button
            onClick={prevQuestion}
            disabled={current === 0}
            className="rounded-lg bg-gray-600 px-5 py-3 text-white disabled:opacity-50"
          >
            Previous
          </button>

          <button
            onClick={nextQuestion}
            disabled={current === order.length - 1}
            className="rounded-lg bg-green-600 px-5 py-3 text-white disabled:opacity-50"
          >
            Next
          </button>

          <button
            onClick={() => startQuiz(mode)}
            className="rounded-lg bg-purple-600 px-5 py-3 text-white"
          >
            Restart
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <p className="text-lg font-semibold">
              {selected === question.correcta ? "✅ Correct" : "❌ Incorrect"}
            </p>

            <p className="mt-2 text-sm text-gray-700">
              Correct answer: {question.opciones[question.correcta]}
            </p>

            {question.explicacion && (
              <p className="mt-2 text-sm text-gray-700">
                Explanation: {question.explicacion}
              </p>
            )}
          </div>
        )}

        {checkedAnswers.every((item) => item) && order.length > 0 && (
          <div className="mt-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-xl font-bold">
            Final Score: {score} / {order.length}
          </div>
        )}
      </div>
    </div>
  );
}