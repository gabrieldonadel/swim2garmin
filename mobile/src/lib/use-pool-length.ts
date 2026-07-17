import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type PoolLength = 25 | 50;

const KEY = "poolLength";
const DEFAULT: PoolLength = 25;

// ponytail: one setting, one AsyncStorage key. Promote to a settings store if more appear.
export function usePoolLength() {
  const [poolLength, setState] = useState<PoolLength>(DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((value) => {
      if (value === "50") {
        setState(50);
      }
    });
  }, []);

  const setPoolLength = (value: PoolLength) => {
    setState(value);
    AsyncStorage.setItem(KEY, String(value));
  };

  return { poolLength, setPoolLength };
}
