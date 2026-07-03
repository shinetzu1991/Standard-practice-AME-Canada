const fs = require("fs");
const similarity = require("string-similarity");

const inputPath = "./data/airframe.json";
const outputPath = "./data/airframe_clean.json";

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const clean = [];

for (const item of data) {
  const currentQuestion = normalize(item.pregunta);

  if (!currentQuestion) continue;

  const duplicate = clean.find((q) => {
    const existingQuestion = normalize(q.pregunta);
    const score = similarity.compareTwoStrings(currentQuestion, existingQuestion);
    return score >= 0.92;
  });

  if (duplicate) {
    console.log("Removed duplicate:");
    console.log("KEEP:", duplicate.id, "-", duplicate.pregunta);
    console.log("DROP:", item.id, "-", item.pregunta);
    console.log("--------------------------------");
    continue;
  }

  clean.push(item);
}

fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2));

console.log("Original:", data.length);
console.log("Clean:", clean.length);
console.log("Removed:", data.length - clean.length);
console.log("Created:", outputPath);