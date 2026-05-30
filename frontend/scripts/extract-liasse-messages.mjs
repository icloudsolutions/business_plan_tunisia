import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.join(__dirname, "../src/lib/liasse-wizard/field-meta.ts"),
  "utf8"
);

const steps = {};
const stepRe =
  /^\s+(\w+):\s*\{\s*title:\s*"([^"]+)",\s*explainer:\s*"([^"]+)"/gm;
let m;
while ((m = stepRe.exec(src))) {
  steps[m[1]] = { title: m[2], explainer: m[3] };
}

const fields = {};
const fieldRe =
  /"([^"]+)":\s*\{\s*label:\s*"([^"]+)",\s*hint:\s*"([^"]+)",\s*where:\s*"([^"]+)",\s*example:\s*"([^"]+)"/g;
while ((m = fieldRe.exec(src))) {
  fields[m[1]] = {
    label: m[2],
    hint: m[3],
    where: m[4],
    example: m[5],
  };
}

const out = {
  steps,
  fields,
  fallback: {
    hint: "Valeur utilisée dans le calcul du plan sur 7 ans.",
    where: "Business plan ou données internes.",
    example: "—",
  },
};

fs.mkdirSync(path.join(__dirname, "../messages"), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, "../messages/liasse-fr.json"),
  JSON.stringify(out, null, 2)
);
console.log("steps", Object.keys(steps).length, "fields", Object.keys(fields).length);
