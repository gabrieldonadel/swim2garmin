import { SportType, SportTypes } from "./constants";
import type { EndCondition, TrainingData, WorkoutStep } from "./types";

const loopStepBase = {
  type: "RepeatGroupDTO",
  stepType: {
    stepTypeId: 6,
    stepTypeKey: "repeat",
    displayOrder: 6,
  },
  endCondition: {
    conditionTypeId: 7,
    conditionTypeKey: "iterations",
    displayOrder: 7,
    displayable: false,
  },
};

const freeStrokeType = {
  strokeTypeId: 6,
  strokeTypeKey: "free",
  displayOrder: 6,
};

const mainStepType = {
  stepTypeId: 8,
  stepTypeKey: "main",
  displayOrder: 8,
};

const distanceEndCondition: EndCondition = {
  conditionTypeId: 3,
  conditionTypeKey: "distance",
  displayOrder: 3,
  displayable: true,
};

const restEndCondition: EndCondition = {
  conditionTypeId: 8,
  conditionTypeKey: "fixed.rest",
  displayOrder: 8,
  displayable: true,
};

export const lapEndCondition: EndCondition = {
  conditionTypeId: 1,
  conditionTypeKey: "lap.button",
  displayOrder: 1,
  displayable: true,
};

export const restStepType = {
  stepTypeId: 5,
  stepTypeKey: "rest",
  displayOrder: 5,
};

interface Segment {
  distance: number;
  description: string;
  rest: number;
}

type Item =
  | { kind: "set"; reps: number; segments: Segment[] }
  | { kind: "rest"; seconds: number };

type ParsedLine = Item | { kind: "note"; text: string };

// `1'` → 60, `30"` → 30, `1'30"` → 90
function clockToSeconds(value: string, unit: string, extraSeconds?: string): number {
  const n = parseInt(value, 10);
  return unit === "'" ? n * 60 + (extraSeconds ? parseInt(extraSeconds, 10) : 0) : n;
}

// Pulls the rest out of a set description: `com 30"`, `com 1'`, `com 1'30"`,
// `com 1' descanso`, `com 10 a 15"`, and `com 20` when the closing quote was
// forgotten. Matches without a word boundary to survive typos like
// `estilocom 30"`.
// ponytail: ranges take the minimum; when reps have different rests
// (`3 A1 com 20", 2 A2 com 40"`) the first one wins.
function extractRest(text: string): { rest: number; text: string } {
  const quoted = text.match(/com\s+(\d+)(?:\s*a\s*\d+)?\s*(['"])\s*(\d+")?\s*(?:descanso)?/);
  if (quoted) {
    return {
      rest: clockToSeconds(quoted[1], quoted[2], quoted[3]),
      text: text.replace(quoted[0], " "),
    };
  }
  const bare = text.match(/com\s+(\d+)(?:\s*a\s*\d+)?\s*$/);
  if (bare) {
    return { rest: parseInt(bare[1], 10), text: text.replace(bare[0], " ") };
  }
  return { rest: 0, text };
}

function cleanDescription(text: string): string {
  return text.replace(/\s{2,}/g, " ").trim();
}

// One part of a `2x (25m crawl prog com 30", 25m A1 perna costas)` block
function parseSegment(part: string): Segment | null {
  const match = part.trim().match(/^(\d+)\s*m\b\s*(.*)$/);
  if (!match) {
    return null;
  }
  const { rest, text } = extractRest(match[2]);
  return { distance: parseInt(match[1], 10), description: cleanDescription(text), rest };
}

function parseLine(raw: string): ParsedLine {
  const line = raw.replace(/^-\s*/, "").trim();

  // standalone rest between sets: `1' descanso`, `90" descanso`, `1'30" descanso`
  const restLine = line.match(/^(\d+)(['"])\s*(\d+")?.*descanso/);
  if (restLine) {
    return { kind: "rest", seconds: clockToSeconds(restLine[1], restLine[2], restLine[3]) };
  }

  // repeats of a multi-distance block: `2x (25m crawl prog com 30", 25m A1 perna costas) com 15"`
  const multi = line.match(/^(\d+)(?:\s*a\s*\d+)?\s*x\s*\(([^)]*)\)\s*(.*)$/);
  if (multi) {
    const segments = multi[2]
      .split(/[,/]/)
      .map(parseSegment)
      .filter((segment): segment is Segment => segment !== null);
    if (segments.length > 0) {
      const outer = extractRest(multi[3]);
      const last = segments[segments.length - 1];
      last.rest = last.rest || outer.rest;
      return { kind: "set", reps: parseInt(multi[1], 10), segments };
    }
  }

  // `4x50m técnica com 15"`, `2 a 4x100m ...`, `4x 50m ...`
  // ponytail: rep/distance/rest ranges (`2 a 4x`) take the minimum
  const repeat = line.match(/^(\d+)(?:\s*a\s*\d+)?\s*x\s*(\d+)(?:\s*a\s*\d+)?\s*m\b\s*(.*)$/);
  if (repeat) {
    const { rest, text } = extractRest(repeat[3]);
    return {
      kind: "set",
      reps: parseInt(repeat[1], 10),
      segments: [{ distance: parseInt(repeat[2], 10), description: cleanDescription(text), rest }],
    };
  }

  // `200m A1 livre com 20"`, `200 a 300m A1 braço`
  const single = line.match(/^(\d+)(?:\s*a\s*\d+)?\s*m\b\s*(.*)$/);
  if (single) {
    const { rest, text } = extractRest(single[2]);
    return {
      kind: "set",
      reps: 1,
      segments: [{ distance: parseInt(single[1], 10), description: cleanDescription(text), rest }],
    };
  }

  return { kind: "note", text: line };
}

export function parseTrainingText(text: string): TrainingData {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const items: Item[] = [];

  const push = (parsed: ParsedLine, list: Item[]) => {
    if (parsed.kind === "note") {
      // annotation lines (`1o crawl`, `Variar Ritmo Respiratório:`) attach to
      // the previous set so the instruction still shows on the watch
      const prev = [...list].reverse().find((item) => item.kind === "set");
      const segment = prev?.kind === "set" ? prev.segments[prev.segments.length - 1] : undefined;
      if (segment) {
        segment.description = segment.description
          ? `${segment.description}; ${parsed.text}`
          : parsed.text;
      }
      return;
    }
    list.push(parsed);
  };

  for (let i = 0; i < lines.length; i++) {
    // `Realizar 2x a série abaixo:` followed by a bulleted block
    // ponytail: unrolled instead of nested, Garmin pool workouts don't nest repeats
    const repeatAll = lines[i].match(/^realizar\s*(\d+)\s*x/i);
    if (repeatAll) {
      const block: Item[] = [];
      while (i + 1 < lines.length && lines[i + 1].startsWith("-")) {
        push(parseLine(lines[++i]), block);
      }
      for (let t = parseInt(repeatAll[1], 10); t > 0; t--) {
        items.push(...block);
      }
      continue;
    }
    push(parseLine(lines[i]), items);
  }

  const workoutSteps: WorkoutStep[] = [];
  let stepOrder = 1;
  let totalDistance = 0;

  for (const item of items) {
    if (item.kind === "rest") {
      workoutSteps.push({
        type: "ExecutableStepDTO",
        stepOrder: stepOrder++,
        stepType: restStepType,
        endCondition: restEndCondition,
        endConditionValue: item.seconds,
      });
      continue;
    }

    const groupOrder = stepOrder++;
    const repeatSteps: WorkoutStep[] = [];
    for (const segment of item.segments) {
      totalDistance += segment.distance * item.reps;
      repeatSteps.push({
        type: "ExecutableStepDTO",
        stepOrder: stepOrder++,
        description: segment.description,
        stepType: mainStepType,
        endCondition: distanceEndCondition,
        endConditionValue: segment.distance,
        strokeType: freeStrokeType,
      });
      if (segment.rest > 0) {
        repeatSteps.push({
          type: "ExecutableStepDTO",
          stepOrder: stepOrder++,
          stepType: restStepType,
          endCondition: restEndCondition,
          endConditionValue: segment.rest,
        });
      }
    }

    workoutSteps.push({
      ...loopStepBase,
      stepOrder: groupOrder,
      numberOfIterations: item.reps,
      workoutSteps: repeatSteps,
    });

    // add lap button press
    workoutSteps.push({
      stepOrder: stepOrder++,
      stepType: restStepType,
      type: "ExecutableStepDTO",
      endCondition: lapEndCondition,
      endConditionValue: 200,
    });
  }

  return {
    sportType: SportTypes[SportType.SWIMMING],
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: SportTypes[SportType.SWIMMING],
        workoutSteps: workoutSteps,
      },
    ],
    estimatedDistanceInMeters: totalDistance,
  };
}
