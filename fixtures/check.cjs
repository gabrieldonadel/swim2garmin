// Parser check against real TrainingPeaks descriptions (fixtures/descriptions.json).
// Run with: node fixtures/check.cjs
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
execSync(
  "npx tsc src/parser.ts --outDir .parser-check --module commonjs --target es2020 --esModuleInterop --skipLibCheck",
  { cwd: root, stdio: "inherit" }
);
fs.writeFileSync(path.join(root, ".parser-check", "package.json"), '{"type":"commonjs"}');
const { parseTrainingText } = require(path.join(root, ".parser-check", "parser.js"));
const descriptions = require("./descriptions.json");

const steps = (data) => data.workoutSegments[0].workoutSteps;
const flat = (data) => steps(data).flatMap((s) => (s.workoutSteps ? s.workoutSteps : [s]));
const restsIn = (data) =>
  flat(data).filter((s) => s.endCondition.conditionTypeKey === "fixed.rest");

// --- targeted cases ---

// plain set
let d = parseTrainingText('200m A1 livre com 20"');
assert.equal(d.estimatedDistanceInMeters, 200);
assert.equal(restsIn(d)[0].endConditionValue, 20);

// repeats, minute rest
d = parseTrainingText("15x100m crawl (4 A2, 1 A1) com 20\"\n3x800m A1 com 1'");
assert.equal(d.estimatedDistanceInMeters, 1500 + 2400);
assert.deepEqual(restsIn(d).map((s) => s.endConditionValue), [20, 20, 60, 60]);

// ranges take the minimum; missing closing quote still parses
d = parseTrainingText("2 a 4x50m A1 livre com 10 a 15\"\n4 a 6x100m A2 crawl com 20");
assert.equal(d.estimatedDistanceInMeters, 2 * 50 + 4 * 100);
assert.deepEqual(restsIn(d).map((s) => s.endConditionValue), [10, 10, 20, 20]);

// distance range without repeats
d = parseTrainingText("200 a 300m A1 braço palmar");
assert.equal(d.estimatedDistanceInMeters, 200);

// standalone rest lines
d = parseTrainingText("8x25m crawl progressivo com 25\"\n1' descanso\n300m crawl ritmo IM com 30\"");
assert.equal(d.estimatedDistanceInMeters, 500);
assert.equal(
  steps(d).find((s) => s.endCondition.conditionTypeKey === "fixed.rest").endConditionValue,
  60
);
assert.equal(parseTrainingText("- 1'30\" descanso").workoutSegments[0].workoutSteps[0].endConditionValue, 90);

// multi-distance repeat block with inner rest
d = parseTrainingText('2x (25m crawl prog com 30", 25m A1 perna costas) com 15"');
assert.equal(d.estimatedDistanceInMeters, 100);
assert.deepEqual(restsIn(d).map((s) => s.endConditionValue), [30, 15, 15]);

// "Realizar 2x a série abaixo" unrolls the bulleted block
d = parseTrainingText(
  'Realizar 2x a série abaixo:\n- 4x25m velocidade com 40"\n- 100m A3 com 60"\n- 90" descanso'
);
assert.equal(d.estimatedDistanceInMeters, 2 * (100 + 100));
// `100m A3 com 60"` then `90" descanso`: one 90" rest, not 60" + 90"
assert.equal(steps(d).filter((s) => !s.workoutSteps && s.endConditionValue === 90).length, 2);
assert.equal(steps(d).filter((s) => !s.workoutSteps && s.endConditionValue === 60).length, 0);

// annotation lines attach to the previous step
d = parseTrainingText('3x800m A1 com 1\'\n1o crawl\n2o braço\n3o crawl palmar');
assert.equal(steps(d).length, 2); // one group + its rest, notes create no steps
assert.ok(flat(d)[0].description.includes("2o braço"));

// typo: missing space before "com"
d = parseTrainingText('200m A1 variando estilocom 30"');
assert.equal(restsIn(d)[0].endConditionValue, 30);

// --- step layout (validated on the Forerunner emulator) ---
const kinds = (list) =>
  list.map((s) =>
    s.workoutSteps
      ? `x${s.numberOfIterations}[${kinds(s.workoutSteps)}]${s.skipLastRestStep ? "!" : ""}`
      : s.endCondition.conditionTypeKey === "distance"
        ? `${s.endConditionValue}m`
        : s.endCondition.conditionTypeKey === "lap.button"
          ? "lap"
          : `${s.endConditionValue}s`
  ).join(",");

// a single set is flat: no repeat ×1, no LAP rest after it
assert.equal(kinds(steps(parseTrainingText('100m com 30"\n100m'))), "100m,30s,100m");
// a repeat skips its last rest; the set's rest follows the repeat instead
assert.equal(kinds(steps(parseTrainingText("2x1000m A1 com 1'"))), "x2[1000m,60s]!,60s");
// a multi-distance single set keeps its inner rests
assert.equal(kinds(steps(parseTrainingText('1x (50m com 10", 50m) com 20"'))), "50m,10s,50m,20s");
// lapRest: a LAP rest replaces the set's timed rest (never timed rest -> LAP rest)
assert.equal(
  kinds(steps(parseTrainingText('200m com 20"\n4x50m com 15"\n1\' descanso', { lapRest: true }))),
  "200m,lap,x4[50m,15s]!,lap"
);
// steps are numbered in order, including the repeat itself
const orders = (list) => list.flatMap((s) => [s.stepOrder, ...(s.workoutSteps ? orders(s.workoutSteps) : [])]);
const numbered = orders(steps(parseTrainingText('200m com 20"\n3x100m com 15"\n1\' descanso\n50m')));
assert.deepEqual(numbered, numbered.map((_, i) => i + 1));

// kick sets are drill steps so the watch logs their distance on LAP
d = parseTrainingText("6x25m A1 (1 crawl, 1 perna) com 5\"\n200m A1 livre");
assert.equal(flat(d)[0].strokeType.strokeTypeKey, "drill");
assert.equal(flat(d)[0].drillType.drillTypeKey, "kick");
assert.equal(flat(d).find((s) => s.endConditionValue === 200).strokeType.strokeTypeKey, "free");

// --- full fixture sweep ---
const setLike = (line) => /^\d+\s*(?:a\s*\d+)?\s*x|^\d+\s*(?:a\s*\d+)?\s*m\b/.test(line);
const restLike = (line) => /^\d+['"]/.test(line) && line.includes("descanso");

let failures = 0;
for (const description of descriptions) {
  const total = parseTrainingText(description).estimatedDistanceInMeters;
  if (!(total > 0)) {
    console.error(`ZERO DISTANCE:\n${description}\n`);
    failures++;
  }
  for (const raw of description.split("\n")) {
    const line = raw.trim().replace(/^-\s*/, "");
    if (!line || /^realizar/i.test(line)) continue;
    const parsed = parseTrainingText(line);
    if (setLike(line) && !(parsed.estimatedDistanceInMeters > 0)) {
      console.error(`SET NOT PARSED: ${line}`);
      failures++;
    }
    if (setLike(line) && /com\s*\d|com \d/.test(line) && restsIn(parsed).length === 0) {
      console.error(`REST NOT PARSED: ${line}`);
      failures++;
    }
    if (restLike(line) && steps(parsed).length !== 1) {
      console.error(`REST LINE NOT PARSED: ${line}`);
      failures++;
    }
  }
}

assert.equal(failures, 0, `${failures} fixture failure(s)`);
console.log(`OK — ${descriptions.length} fixtures parsed, targeted cases pass`);
