import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useMemo, useRef, useState } from "react";
import {
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

import {
  GarminConnect,
  type GarminConnectHandle,
  type GarminStatus,
  type SendResult,
} from "@/components/garmin-connect";
import { TrainingPreview } from "@/components/training-preview";
import {
  TrainingPeaksConnect,
  type TrainingPeaksConnectHandle,
  type TrainingPeaksStatus,
  type TpWorkout,
  type WeekResult,
} from "@/components/trainingpeaks-connect";
import { baseTrainingData } from "@/lib/constants";
import { parseTrainingText } from "@/lib/parser";

const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

// The Android Material date picker reports the picked day as midnight UTC,
// which is the *previous* day in any UTC- timezone — rebuild it as local midnight.
const utcDayToLocal = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// Monday–Sunday of the current week
const weekRange = () => {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
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
  const garmin = useRef<GarminConnectHandle>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<GarminStatus>("loading");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const tp = useRef<TrainingPeaksConnectHandle>(null);
  const tpFetchPending = useRef(false);
  const [tpStatus, setTpStatus] = useState<TrainingPeaksStatus>("loading");
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

  const send = () => {
    if (!parsed) {
      return;
    }
    setSending(true);
    setMessage(null);
    garmin.current?.sendWorkout(
      {
        ...baseTrainingData,
        ...parsed,
        workoutName: `Swim2Garmin ${parsed.estimatedDistanceInMeters}m`,
      },
      scheduling ? toIsoDay(scheduleDate) : undefined
    );
  };

  const fetchWeek = () => {
    setMessage(null);
    if (tpStatus !== "ready") {
      tpFetchPending.current = true;
      tp.current?.showLogin();
      return;
    }
    setTpLoading(true);
    setTpWorkouts(null);
    const { start, end } = weekRange();
    tp.current?.fetchWeek(start, end);
  };

  const handleTpStatus = (status: TrainingPeaksStatus) => {
    setTpStatus(status);
    if (status === "ready" && tpFetchPending.current) {
      tpFetchPending.current = false;
      setTpLoading(true);
      const { start, end } = weekRange();
      tp.current?.fetchWeek(start, end);
    }
  };

  const handleWeek = (result: WeekResult) => {
    setTpLoading(false);
    if (!result.ok) {
      setMessage({ text: `TrainingPeaks: ${result.error}`, error: true });
    } else if (!result.workouts?.length) {
      setMessage({ text: "Nenhum treino de natação nesta semana.", error: false });
    } else {
      setTpWorkouts(result.workouts);
    }
  };

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

  const handleResult = (result: SendResult) => {
    setSending(false);
    if (result.ok) {
      if (result.scheduled === true) {
        setMessage({
          text: `Treino criado e agendado para ${scheduleDate.toLocaleDateString("pt-BR")} ✓`,
          error: false,
        });
      } else if (result.scheduled === false) {
        setMessage({
          text: `Treino criado, mas o agendamento falhou: ${result.scheduleBody}`,
          error: true,
        });
      } else {
        setMessage({ text: "Treino criado no Garmin Connect ✓", error: false });
      }
    } else if (result.status === 401 || result.status === 403) {
      setMessage({ text: "Sessão expirada — entre no Garmin novamente.", error: true });
      setStatus("login");
    } else {
      setMessage({ text: `Falhou (${result.status}): ${result.body}`, error: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.tpButton} disabled={tpLoading} onPress={fetchWeek}>
          <Text style={styles.tpButtonText}>
            {tpLoading ? "Buscando…" : "Buscar treinos da semana no TrainingPeaks"}
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
          placeholder={'Cole seu treino de natação aqui…\n\n200m A1 livre com 20"\n4x50m técnica com 15"'}
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
              />
            ) : (
              <Pressable onPress={() => setPickerOpen(true)}>
                <Text style={styles.scheduleDate}>{scheduleDate.toLocaleDateString("pt-BR")}</Text>
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

        {status === "login" && (
          <Pressable style={styles.loginBanner} onPress={() => garmin.current?.showLogin()}>
            <Text style={styles.loginBannerText}>
              Não conectado ao Garmin Connect — toque para entrar
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, (!parsed || status !== "ready" || sending) && styles.buttonDisabled]}
          disabled={!parsed || status !== "ready" || sending}
          onPress={send}
        >
          <Text style={styles.buttonText}>
            {sending
              ? "Enviando…"
              : status === "loading"
                ? "Conectando ao Garmin…"
                : "Enviar para o Garmin"}
          </Text>
        </Pressable>

        {message && (
          <Text style={[styles.message, message.error ? styles.error : styles.success]}>
            {message.text}
          </Text>
        )}

        {parsed && <TrainingPreview data={parsed} />}
      </ScrollView>

      <GarminConnect ref={garmin} onStatus={setStatus} onResult={handleResult} />
      <TrainingPeaksConnect ref={tp} onStatus={handleTpStatus} onWeek={handleWeek} />
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
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
});
