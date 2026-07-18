import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccounts } from "@/components/accounts-context";
import { type SendResult } from "@/components/garmin-connect";
import { TrainingPreview } from "@/components/training-preview";
import {
  type TpWorkout,
  type WeekResult,
} from "@/components/trainingpeaks-connect";
import { baseTrainingData } from "@/lib/constants";
import { parseTrainingText } from "@/lib/parser";
import { type PoolLength } from "@/lib/use-pool-length";
import { type TrainingData } from "@/lib/types";

// distances of every executable step (repeat groups are flattened one level)
const stepDistances = (data: TrainingData): number[] =>
  data.workoutSegments[0].workoutSteps
    .flatMap((step) => step.workoutSteps ?? [step])
    .filter((step) => step.endCondition.conditionTypeKey === "distance")
    .map((step) => step.endConditionValue ?? 0);

const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

// The Android Material date picker reports the picked day as midnight UTC,
// which is the *previous* day in any UTC- timezone — rebuild it as local midnight.
const utcDayToLocal = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// Monday–Sunday of the current week
const weekRange = () => {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6,
  );
  return { start: toIsoDay(monday), end: toIsoDay(sunday) };
};

const dayLabel = (isoDay: string) => {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

export default function Index() {
  const insets = useSafeAreaInsets();
  const accounts = useAccounts();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
    workoutId?: number;
  } | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const tpFetchPending = useRef(false);
  const [tpLoading, setTpLoading] = useState(false);
  const [tpWorkouts, setTpWorkouts] = useState<TpWorkout[] | null>(null);

  const parsed = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    const data = parseTrainingText(trimmed);
    return data.estimatedDistanceInMeters > 0 ? data : null;
  }, [text]);

  const handleResult = (result: SendResult) => {
    setSending(false);
    if (result.ok) {
      if (result.scheduled === true) {
        setMessage({
          text: `Treino criado e agendado para ${scheduleDate.toLocaleDateString("pt-BR")} ✓`,
          error: false,
          workoutId: result.workoutId,
        });
      } else if (result.scheduled === false) {
        setMessage({
          text: `Treino criado, mas o agendamento falhou: ${result.scheduleBody}`,
          error: true,
          workoutId: result.workoutId,
        });
      } else {
        setMessage({
          text: "Treino criado no Garmin Connect ✓",
          error: false,
          workoutId: result.workoutId,
        });
      }
    } else if (result.status === 401 || result.status === 403) {
      setMessage({
        text: "Sessão expirada — entre no Garmin novamente.",
        error: true,
      });
      accounts.garminLogin();
    } else {
      setMessage({
        text: `Falhou (${result.status}): ${result.body}`,
        error: true,
      });
    }
  };

  const dispatchSend = (poolLength: PoolLength) => {
    if (!parsed) {
      return;
    }
    setSending(true);
    setMessage(null);
    accounts.sendWorkout(
      {
        ...baseTrainingData,
        ...parsed,
        poolLength,
        workoutName: `Swim2Garmin ${parsed.estimatedDistanceInMeters}m`,
      },
      scheduling ? toIsoDay(scheduleDate) : undefined,
      handleResult,
    );
  };

  const send = () => {
    if (!parsed) {
      return;
    }
    // A 25m/75m step can't be swum in a 50m pool (the watch counts whole
    // lengths), so warn before sending an incompatible pool length.
    const incompatible =
      accounts.poolLength === 50 &&
      stepDistances(parsed).some((distance) => distance % 50 !== 0);
    if (incompatible) {
      Alert.alert(
        "Distâncias incompatíveis",
        "Este treino tem distâncias que não cabem numa piscina de 50m (ex.: 25m, 75m). Numa piscina de 50m o relógio só conta voltas completas.",
        [
          { text: "Trocar para 25m", onPress: () => { accounts.setPoolLength(25); dispatchSend(25); } },
          { text: "Enviar mesmo assim", onPress: () => dispatchSend(50) },
          { text: "Cancelar", style: "cancel" },
        ],
      );
      return;
    }
    dispatchSend(accounts.poolLength);
  };

  const handleWeek = (result: WeekResult) => {
    setTpLoading(false);
    if (!result.ok) {
      setMessage({ text: `TrainingPeaks: ${result.error}`, error: true });
    } else if (!result.workouts?.length) {
      setMessage({
        text: "Nenhum treino de natação nesta semana.",
        error: false,
      });
    } else {
      setTpWorkouts(result.workouts);
    }
  };

  const fetchWeek = () => {
    setMessage(null);
    if (accounts.tpStatus !== "ready") {
      tpFetchPending.current = true;
      accounts.tpLogin();
      return;
    }
    setTpLoading(true);
    setTpWorkouts(null);
    const { start, end } = weekRange();
    accounts.fetchWeek(start, end, handleWeek);
  };

  // resume a pending fetch right after the TrainingPeaks login completes
  useEffect(() => {
    if (accounts.tpStatus === "ready" && tpFetchPending.current) {
      tpFetchPending.current = false;
      setTpLoading(true);
      const { start, end } = weekRange();
      accounts.fetchWeek(start, end, handleWeek);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.tpStatus]);

  const pickWorkout = (workout: TpWorkout) => {
    setText(workout.description);
    setTpWorkouts(null);
    setMessage(null);
    const [year, month, day] = workout.day.split("-").map(Number);
    const workoutDay = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (workoutDay.getTime() >= today.getTime()) {
      setScheduling(true);
      setScheduleDate(workoutDay);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.tpButton}
          disabled={tpLoading}
          onPress={fetchWeek}
        >
          <Text style={styles.tpButtonText}>
            {tpLoading
              ? "Buscando…"
              : "Buscar treinos da semana no TrainingPeaks"}
          </Text>
        </Pressable>

        {tpWorkouts && (
          <View style={styles.tpList}>
            {tpWorkouts.map((workout, index) => (
              <Pressable
                key={workout.day + index}
                style={styles.tpItem}
                onPress={() => pickWorkout(workout)}
              >
                <Text style={styles.tpItemDay}>{dayLabel(workout.day)}</Text>
                <Text style={styles.tpItemInfo}>
                  {workout.title} · {workout.distance}m
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.input}
          multiline
          placeholder={
            'Cole seu treino de natação aqui…\n\n200m A1 livre com 20"\n4x50m técnica com 15"'
          }
          value={text}
          onChangeText={(value) => {
            setText(value);
            setMessage(null);
          }}
          textAlignVertical="top"
          autoCorrect={false}
        />

        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleLabel}>Adicionar ao calendário</Text>
          {scheduling &&
            (Platform.OS === "ios" ? (
              <DateTimePicker
                value={scheduleDate}
                mode="date"
                display="compact"
                locale="pt_BR"
                minimumDate={new Date()}
                onValueChange={(_, date) => setScheduleDate(date)}
                style={styles.iosDatePicker}
              />
            ) : (
              <Pressable onPress={() => setPickerOpen(true)}>
                <Text style={styles.scheduleDate}>
                  {scheduleDate.toLocaleDateString("pt-BR")}
                </Text>
              </Pressable>
            ))}
          <Switch value={scheduling} onValueChange={setScheduling} />
        </View>
        {pickerOpen && (
          <DateTimePicker
            value={scheduleDate}
            mode="date"
            minimumDate={new Date()}
            onValueChange={(_, date) => {
              setScheduleDate(utcDayToLocal(date));
              setPickerOpen(false);
            }}
            onDismiss={() => setPickerOpen(false)}
            positiveButton={{ label: "OK" }}
            negativeButton={{ label: "Cancelar" }}
          />
        )}

        {accounts.garminStatus === "login" && (
          <Pressable style={styles.loginBanner} onPress={accounts.garminLogin}>
            <Text style={styles.loginBannerText}>
              Não conectado ao Garmin Connect — toque para entrar
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.button,
            (!parsed || accounts.garminStatus !== "ready" || sending) &&
              styles.buttonDisabled,
          ]}
          disabled={!parsed || accounts.garminStatus !== "ready" || sending}
          onPress={send}
        >
          <Text style={styles.buttonText}>
            {sending
              ? "Enviando…"
              : accounts.garminStatus === "loading"
                ? "Conectando ao Garmin…"
                : "Enviar para o Garmin"}
          </Text>
        </Pressable>

        {message && (
          <Text
            style={[
              styles.message,
              message.error ? styles.error : styles.success,
            ]}
          >
            {message.text}
          </Text>
        )}
        {message?.workoutId && (
          <Pressable onPress={() => accounts.openGarminWorkout(message.workoutId!)}>
            <Text style={styles.workoutLink}>
              Ver treino no Garmin Connect →
            </Text>
          </Pressable>
        )}

        {parsed && <TrainingPreview data={parsed} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  tpButton: {
    borderWidth: 1,
    borderColor: "#0d9488",
    borderRadius: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tpButtonText: {
    color: "#0d9488",
    fontWeight: "600",
  },
  tpList: {
    gap: 8,
  },
  tpItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0fdfa",
    borderRadius: 10,
    padding: 12,
  },
  tpItemDay: {
    fontWeight: "700",
    color: "#0d9488",
    textTransform: "capitalize",
  },
  tpItemInfo: {
    flex: 1,
    color: "#333",
  },
  input: {
    minHeight: 180,
    maxHeight: 320,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  scheduleLabel: {
    flex: 1,
    fontWeight: "600",
  },
  scheduleDate: {
    color: "#0d9488",
    fontWeight: "600",
  },
  // the SwiftUI Host only self-sizes vertically — without an explicit width
  // it stretches under the Switch and never receives taps
  iosDatePicker: {
    width: 150,
  },
  loginBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
  },
  loginBannerText: {
    color: "#92400e",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#0d9488",
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  message: {
    textAlign: "center",
    padding: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  success: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  workoutLink: {
    color: "#0d9488",
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
});
