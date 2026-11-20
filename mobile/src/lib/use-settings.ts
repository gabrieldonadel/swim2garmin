import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type PoolLength = 25 | 50;

const POOL_LENGTH_KEY = "poolLength";
const LAP_REST_KEY = "lapRest";

// ponytail: one AsyncStorage key per setting, read once on mount.
export function useSettings() {
  const [poolLength, setPoolLengthState] = useState<PoolLength>(25);
  // end each set with "press LAP when ready" instead of its timed rest
  const [lapRest, setLapRestState] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([POOL_LENGTH_KEY, LAP_REST_KEY]).then((pairs) => {
      const stored = Object.fromEntries(pairs);
      if (stored[POOL_LENGTH_KEY] === "50") {
        setPoolLengthState(50);
      }
      if (stored[LAP_REST_KEY] === "true") {
        setLapRestState(true);
      }
    });
  }, []);

  const setPoolLength = (value: PoolLength) => {
    setPoolLengthState(value);
    AsyncStorage.setItem(POOL_LENGTH_KEY, String(value));
  };

  const setLapRest = (value: boolean) => {
    setLapRestState(value);
    AsyncStorage.setItem(LAP_REST_KEY, String(value));
  };

  return { poolLength, setPoolLength, lapRest, setLapRest };
}
