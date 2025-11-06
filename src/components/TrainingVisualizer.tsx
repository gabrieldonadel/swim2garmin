import { lapEndCondition, parseTrainingText, restStepType } from "@src/parser";
import { WorkoutStep } from "@src/types";

interface Props {
  trainingText: string;
}

export const TrainingVisualizer = ({ trainingText }: Props) => {
  const data = parseTrainingText(trainingText);

  if (!data || data.workoutSegments.length === 0) {
    return <div>No training data to display.</div>;
  }

  return (
    <div className="visualizer-container">
      <h2 className="text-lg font-medium text-gray-800 mb-4">
        Training Preview
      </h2>
      {data.workoutSegments?.length ? (
        <p>Total distance: {data.estimatedDistanceInMeters}</p>
      ) : null}
      {data.workoutSegments.map((segment, index) => (
        <div key={segment.segmentOrder}>
          {segment.workoutSteps.map((step) => (
            <div
              key={String(step.stepOrder) + index}
              className="visualizer-step"
            >
              {formatStep(step)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const formatStep = (step: WorkoutStep) => {
  if (step.type === "RepeatGroupDTO") {
    return (
      <div className="visualizer-step-loop">
        <strong>{`Loop ${step.numberOfIterations} times:`}</strong>
        {step.workoutSteps?.map((childStep, index) => (
          <div key={String(step.stepOrder) + index} className="visualizer-step">
            {formatStep(childStep)}
          </div>
        ))}
      </div>
    );
  }
  if (step.stepType?.stepTypeKey === restStepType.stepTypeKey) {
    return (
      <div>
        {step.endCondition.conditionTypeKey === lapEndCondition.conditionTypeKey
          ? "Lap Button Press"
          : step.endConditionValue + " seconds"}
      </div>
    );
  }
  const { endConditionValue, description } = step;

  return (
    <div>
      {endConditionValue}m {description ? `- ${description}` : ""}
    </div>
  );
};
