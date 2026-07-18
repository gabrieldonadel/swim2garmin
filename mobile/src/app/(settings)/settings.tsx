import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useAccounts } from "@/components/accounts-context";

const REPO_URL = "https://github.com/gabrieldonadel/swim2garmin";

const STATUS_LABEL = {
  loading: "Verificando…",
  login: "Não conectado",
  ready: "Conectado ✓",
} as const;

function AccountRow({
  name,
  status,
  onLogin,
  onLogout,
}: {
  name: string;
  status: keyof typeof STATUS_LABEL;
  onLogin(): void;
  onLogout(): void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={[styles.rowStatus, status === "ready" && styles.connected]}>
          {STATUS_LABEL[status]}
        </Text>
      </View>
      {status === "ready" ? (
        <Pressable style={[styles.rowButton, styles.logoutButton]} onPress={onLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.rowButton} onPress={onLogin} disabled={status === "loading"}>
          <Text style={styles.loginText}>Entrar</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Settings() {
  const accounts = useAccounts();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Contas</Text>
      <AccountRow
        name="Garmin Connect"
        status={accounts.garminStatus}
        onLogin={accounts.garminLogin}
        onLogout={accounts.garminLogout}
      />
      <AccountRow
        name="TrainingPeaks"
        status={accounts.tpStatus}
        onLogin={accounts.tpLogin}
        onLogout={accounts.tpLogout}
      />

      <Text style={styles.sectionTitle}>Piscina</Text>
      <View style={styles.row}>
        <Text style={[styles.rowName, styles.rowInfo]}>Comprimento</Text>
        <View style={styles.segmented}>
          {([25, 50] as const).map((length) => {
            const selected = accounts.poolLength === length;
            return (
              <Pressable
                key={length}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => accounts.setPoolLength(length)}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {length}m
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Sobre</Text>
      <Pressable style={styles.row} onPress={() => Linking.openURL(REPO_URL)}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>Código-fonte</Text>
          <Text style={styles.rowStatus}>github.com/gabrieldonadel/swim2garmin</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontWeight: "600",
    fontSize: 16,
  },
  rowStatus: {
    color: "#6b7280",
    fontSize: 13,
  },
  connected: {
    color: "#0d9488",
  },
  rowButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#0d9488",
  },
  logoutButton: {
    borderColor: "#dc2626",
  },
  loginText: {
    color: "#0d9488",
    fontWeight: "600",
  },
  logoutText: {
    color: "#dc2626",
    fontWeight: "600",
  },
  chevron: {
    color: "#9ca3af",
    fontSize: 18,
    fontWeight: "600",
  },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#0d9488",
    borderRadius: 8,
    overflow: "hidden",
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  segmentSelected: {
    backgroundColor: "#0d9488",
  },
  segmentText: {
    color: "#0d9488",
    fontWeight: "600",
  },
  segmentTextSelected: {
    color: "#fff",
  },
});
