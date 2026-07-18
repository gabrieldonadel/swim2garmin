export enum SportType {
  SWIMMING = "swimming",
}

export const SportTypes: Record<
  SportType,
  { sportTypeId: number; sportTypeKey: string; displayOrder: number }
> = {
  [SportType.SWIMMING]: {
    sportTypeId: 4,
    sportTypeKey: "swimming",
    displayOrder: 3,
  },
};

// Base payload for creating a workout. Trimmed from the extension's PUT
// payload: no workoutId/ownerId/dates — the server fills those on create.
// poolLength is a default; the screen overrides it from the user's setting.
export const baseTrainingData = {
  workoutName: "Swim2Garmin",
  description: null,
  sportType: SportTypes[SportType.SWIMMING],
  subSportType: null,
  poolLength: 25,
  poolLengthUnit: {
    unitId: 1,
    unitKey: "meter",
    factor: 100,
  },
  estimatedDurationInSecs: 0,
  estimatedDistanceInMeters: null,
  avgTrainingSpeed: 0.83333333333334,
  estimateType: "TIME_ESTIMATED",
  shared: false,
  isWheelchair: false,
};
