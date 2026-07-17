import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import {
  GarminConnect,
  type GarminConnectHandle,
  type GarminStatus,
  type SendResult,
} from "@/components/garmin-connect";
import {
  TrainingPeaksConnect,
  type TrainingPeaksConnectHandle,
  type TrainingPeaksStatus,
  type WeekResult,
} from "@/components/trainingpeaks-connect";
import { usePoolLength, type PoolLength } from "@/lib/use-pool-length";

interface Accounts {
  garminStatus: GarminStatus;
  tpStatus: TrainingPeaksStatus;
  garminLogin(): void;
  garminLogout(): void;
  tpLogin(): void;
  tpLogout(): void;
  sendWorkout(payload: object, scheduleDate: string | undefined, onResult: (r: SendResult) => void): void;
  fetchWeek(startDay: string, endDay: string, onWeek: (r: WeekResult) => void): void;
  openGarminWorkout(workoutId: number): void;
  poolLength: PoolLength;
  setPoolLength(value: PoolLength): void;
}

const AccountsContext = createContext<Accounts | null>(null);

// Hosts the two hidden WebViews at the root so any screen (main, settings)
// can trigger login/logout and the login overlay covers the whole app.
export function AccountsProvider({ children }: { children: ReactNode }) {
  const garmin = useRef<GarminConnectHandle>(null);
  const tp = useRef<TrainingPeaksConnectHandle>(null);
  const [garminStatus, setGarminStatus] = useState<GarminStatus>("loading");
  const [tpStatus, setTpStatus] = useState<TrainingPeaksStatus>("loading");
  const onResult = useRef<(r: SendResult) => void>(() => {});
  const onWeek = useRef<(r: WeekResult) => void>(() => {});
  const { poolLength, setPoolLength } = usePoolLength();

  const value: Accounts = {
    garminStatus,
    tpStatus,
    garminLogin: () => garmin.current?.showLogin(),
    garminLogout: () => {
      setGarminStatus("loading");
      garmin.current?.logout();
    },
    tpLogin: () => tp.current?.showLogin(),
    tpLogout: () => {
      setTpStatus("loading");
      tp.current?.logout();
    },
    sendWorkout: (payload, scheduleDate, callback) => {
      onResult.current = callback;
      garmin.current?.sendWorkout(payload, scheduleDate);
    },
    fetchWeek: (startDay, endDay, callback) => {
      onWeek.current = callback;
      tp.current?.fetchWeek(startDay, endDay);
    },
    // Garmin's iOS app doesn't register workout pages as universal links
    // (checked connect.garmin.com AASA), so a deep link is impossible —
    // show the page in our own logged-in WebView instead.
    openGarminWorkout: (workoutId) => {
      garmin.current?.openPage(`https://connect.garmin.com/modern/workout/${workoutId}`);
    },
    poolLength,
    setPoolLength,
  };

  return (
    <AccountsContext.Provider value={value}>
      {children}
      <GarminConnect
        ref={garmin}
        onStatus={setGarminStatus}
        onResult={(result) => onResult.current(result)}
      />
      <TrainingPeaksConnect
        ref={tp}
        onStatus={setTpStatus}
        onWeek={(result) => onWeek.current(result)}
      />
    </AccountsContext.Provider>
  );
}

export function useAccounts(): Accounts {
  const accounts = useContext(AccountsContext);
  if (!accounts) {
    throw new Error("useAccounts must be used inside AccountsProvider");
  }
  return accounts;
}
