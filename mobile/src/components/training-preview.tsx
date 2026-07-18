import { StyleSheet, Text, View } from "react-native";

import { lapEndCondition } from "@/lib/parser";
import type { TrainingData, WorkoutStep } from "@/lib/types";

export function TrainingPreview({ data }: { data: TrainingData }) {
  const steps = data.workoutSegments[0].workoutSteps.filter(
    (step) => step.endCondition.conditionTypeKey !== lapEndCondition.conditionTypeKey
  );

  return (
    <View style={styles.container}>
      <Text style={styles.total}>Total: {data.estimatedDistanceInMeters}m</Text>
      {steps.map((step) => (
        <Step key={step.stepOrder} step={step} />
      ))}
    </View>
  );
}

function Step({ step }: { step: WorkoutStep }) {
  if (step.type === "RepeatGroupDTO") {
    return (
      <View style={styles.group}>
        <Text style={styles.groupLabel}>{step.numberOfIterations}×</Text>
        <View style={styles.groupSteps}>
          {step.workoutSteps?.map((child) => <Step key={child.stepOrder} step={child} />)}
        </View>
      </View>
    );
  }
  if (step.stepType?.stepTypeKey === "rest") {
    return <Text style={styles.rest}>descanso {step.endConditionValue}s</Text>;
  }
  return (
    <Text style={styles.main}>
      {step.endConditionValue}m{step.description ? ` — ${step.description}` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  total: {
    fontWeight: "700",
    marginBottom: 4,
  },
  group: {
    flexDirection: "row",
    gap: 8,
  },
  groupLabel: {
    fontWeight: "700",
    color: "#0d9488",
  },
  groupSteps: {
    flex: 1,
    gap: 2,
  },
  main: {
    color: "#222",
  },
  rest: {
    color: "#888",
  },
});
