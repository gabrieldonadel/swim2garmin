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
