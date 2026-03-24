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

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export default function Home() {
  const [mode, setMode] = useState<"test" | "study">("test");
  const [order, setOrder] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [checkedAnswers, setCheckedAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

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
    setFinished(false);
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

    if (mode === "study" && showAnswer) return;

    const updated = [...selectedAnswers];
    updated[current] = index;
    setSelectedAnswers(updated);
  };

  const handleCheck = () => {
    if (selected === null || finished) return;
    if (mode === "test") return;

    const updatedChecked = [...checkedAnswers];
    updatedChecked[current] = true;
    setCheckedAnswers(updatedChecked);
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
        ? "border-blue-500 bg-blue-100"
        : "border-gray-300 bg-white hover:bg-gray-50";
    }

    if (mode === "study" && !showAnswer) {
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

  if (finished && mode === "test") {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-3xl font-bold">TEST RESULTS</h1>

          <div className="mb-6 rounded-xl border bg-gray-50 p-4">
            <p className="text-xl font-semibold">
              Final Score: {score} / {order.length}
            </p>
            <p className="mt-2 text-lg text-blue-700">Percentage: {percentage}%</p>
            <p className="mt-2 text-lg text-red-600">
              Incorrect Answers: {wrongAnswers.length}
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => startQuiz("test")}
              className="rounded-lg bg-blue-600 px-5 py-3 text-white"
            >
              Restart Test Mode
            </button>

            <button
              onClick={() => startQuiz("study")}
              className="rounded-lg bg-green-600 px-5 py-3 text-white"
            >
              Switch to Study Mode
            </button>
          </div>

          <h2 className="mb-4 text-2xl font-bold">Wrong Answers</h2>

          {wrongAnswers.length === 0 ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-700">
              Perfect score. No wrong answers.
            </div>
          ) : (
            <div className="space-y-6">
              {wrongAnswers.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-red-200 bg-red-50 p-5"
                >
                  <p className="font-semibold text-red-700">
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
                        className="h-auto w-full rounded-lg border"
                      />
                    </div>
                  )}

                  <p className="mt-3 text-sm text-red-700">
                    Your answer: {item.selected}
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    Correct answer: {item.correct}
                  </p>

                  {item.explicacion && (
                    <p className="mt-2 text-sm text-gray-700">
                      Explanation: {item.explicacion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 sm:p-6">
    <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-4 shadow-lg sm:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">
        STANDARD PRACTICES AME CANADA
      </h1>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          Question {current + 1} / {order.length}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-blue-700">
            Selected:{" "}
            {selectedAnswers.filter((answer) => answer !== null).length} / {order.length}
          </p>
          <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-800">
            {mode === "test" ? "TEST MODE" : "STUDY MODE"}
          </span>
        </div>
      </div>

      <p className="mb-5 text-base font-medium leading-relaxed text-gray-900 sm:mb-6 sm:text-lg">
        {question.pregunta}
      </p>

      {question.imagen && (
        <div className="mb-5 sm:mb-6">
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
            className={`w-full rounded-lg border p-3 text-left text-sm text-gray-900 transition sm:p-4 sm:text-base ${getOptionClass(i)}`}
          >
            {op}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {mode === "study" && (
          <button
            onClick={handleCheck}
            disabled={selected === null || showAnswer}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:w-auto sm:text-base"
          >
            Check Answer
          </button>
        )}

        <button
          onClick={prevQuestion}
          disabled={current === 0}
          className="w-full rounded-lg bg-gray-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:w-auto sm:text-base"
        >
          Previous
        </button>

        <button
          onClick={nextQuestion}
          disabled={current === order.length - 1}
          className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:w-auto sm:text-base"
        >
          Next
        </button>

        <button
          onClick={() => startQuiz(mode)}
          className="w-full rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white sm:w-auto sm:text-base"
        >
          Restart
        </button>

        {mode === "test" && (
          <button
            onClick={finishTest}
            className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-medium text-white sm:w-auto sm:text-base"
          >
            Finish Test
          </button>
        )}
      </div>

      {mode === "study" && showAnswer && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-base font-semibold text-gray-900 sm:text-lg">
            {selected === question.correcta ? "✅ Correct" : "❌ Incorrect"}
          </p>

          <p className="mt-2 text-sm text-gray-800 sm:text-base">
            Correct answer: {question.opciones[question.correcta]}
          </p>

          {question.explicacion && (
            <p className="mt-2 text-sm text-gray-800 sm:text-base">
              Explanation: {question.explicacion}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}