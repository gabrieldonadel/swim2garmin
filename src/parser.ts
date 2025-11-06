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

export function parseTrainingText(text: string): TrainingData {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  let totalDistance = 0;
  const workoutSteps: WorkoutStep[] = [];
  let stepOrder = 1;

  for (const line of lines) {
    let repetitions = 1;
    let distance: number;
    let description: string;
    let rest = 0;

    // if includes X it's a repeat
    // inclui o x sem espaço e o m
    const repeatMatch = line.match(/^(\d+)(?:\s*a\s*\d+)?x(\d+)m\s+(.*)/);
    if (repeatMatch) {
      repetitions = parseInt(repeatMatch[1], 10);
      distance = parseInt(repeatMatch[2], 10);
      description = repeatMatch[3];
    } else {
      // extrair distance and description
      const singleMatch = line.match(/^(\d+)m\s+(.*)/);
      if (singleMatch) {
        distance = parseInt(singleMatch[1], 10);
        description = singleMatch[2];
      } else {
        description = "";
        distance = 0;
      }
    }

    totalDistance += distance * repetitions;

    // "com" represents rest in seconds
    const restMatch = description.match(/com (\d+)"/);
    if (restMatch) {
      rest = parseInt(restMatch[1], 10);
      description = description.replace(restMatch[0], "").trim();
    }

    const repeatSteps: WorkoutStep[] = [
      {
        type: "ExecutableStepDTO",
        stepOrder: stepOrder + 1,
        description,
        stepType: {
          stepTypeId: 8,
          stepTypeKey: "main",
          displayOrder: 8,
        },
        endCondition: {
          conditionTypeKey: "distance",
          displayOrder: 3,
          conditionTypeId: 3,
          displayable: true,
        },
        endConditionValue: distance,
        strokeType: freeStrokeType,
      },
    ];

    if (rest > 0) {
      repeatSteps.push({
        type: "ExecutableStepDTO",
        stepOrder: stepOrder + 2,
        stepType: restStepType,
        endCondition: restEndCondition,
        endConditionValue: rest,
      });
    }

    workoutSteps.push({
      ...loopStepBase,
      stepOrder: stepOrder,
      numberOfIterations: repetitions,
      workoutSteps: repeatSteps,
    });

    stepOrder += repeatSteps.length + 1;

    // add lap button press
    workoutSteps.push({
      stepOrder,
      stepType: restStepType,
      type: "ExecutableStepDTO",
      endCondition: lapEndCondition,
      endConditionValue: 200,
    });

    stepOrder += 1;
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
