export interface WorkoutStep {
  type: string;
  stepOrder: number;
  description?: string;
  stepType?: {
    stepTypeId: number;
    stepTypeKey: string;
    displayOrder: number;
    [key: string]: any;
  };
  endCondition: {
    conditionTypeId: number;
    conditionTypeKey: string;
    displayOrder: number;
    displayable: boolean;
    [key: string]: any;
  };
  endConditionValue?: number;
  strokeType?: { [key: string]: any };
  numberOfIterations?: number;
  workoutSteps?: WorkoutStep[];
}

export interface WorkoutSegment {
  segmentOrder: number;
  sportType: { [key: string]: any };
  workoutSteps: WorkoutStep[];
}

export interface TrainingData {
  sportType: { [key: string]: any };
  workoutSegments: WorkoutSegment[];
  estimatedDistanceInMeters: number;
}

export type EndCondition = {
  conditionTypeId: number;
  conditionTypeKey: string;
  displayOrder: number;
  displayable: boolean;
};
