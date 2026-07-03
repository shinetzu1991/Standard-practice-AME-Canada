const fs = require("fs");
const similarity = require("string-similarity");

// <-- cambia el nombre por tu archivo
const data = JSON.parse(fs.readFileSync("./data/airframe.json", "utf8"));

console.log(`\nPreguntas: ${data.length}\n`);

const ids = new Set();

for (let i = 0; i < data.length; i++) {

    if (ids.has(data[i].id)) {
        console.log("================================");
        console.log("ID DUPLICADO");
        console.log(data[i].id);
    }

    ids.add(data[i].id);
}

console.log("\nBuscando preguntas similares...\n");

for (let i = 0; i < data.length; i++) {

    for (let j = i + 1; j < data.length; j++) {

        const q1 = data[i].pregunta.toLowerCase().trim();
        const q2 = data[j].pregunta.toLowerCase().trim();

        const score = similarity.compareTwoStrings(q1, q2);

        if (score > 0.90) {

            console.log("--------------------------------");
            console.log(`Similitud ${(score*100).toFixed(1)}%`);

            console.log("\nID1:", data[i].id);
            console.log(q1);

            console.log("\nID2:", data[j].id);
            console.log(q2);
        }

    }

}