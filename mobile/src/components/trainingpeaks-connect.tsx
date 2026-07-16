import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export type TrainingPeaksStatus = "loading" | "login" | "ready";

export interface TpWorkout {
  day: string; // YYYY-MM-DD
  title: string;
  distance: number;
  description: string;
}

export interface WeekResult {
  ok: boolean;
  workouts?: TpWorkout[];
  error?: string;
}

export interface TrainingPeaksConnectHandle {
  fetchWeek(startDay: string, endDay: string): void;
  showLogin(): void;
  logout(): void;
}

interface Props {
  onStatus(status: TrainingPeaksStatus): void;
  onWeek(result: WeekResult): void;
}

const TP_URL = "https://app.trainingpeaks.com/";

// Logged in = the session cookie can mint an API token. Logged out redirects
// to home.trainingpeaks.com, where the cross-origin call fails → login.
const PROBE_JS = `(function () {
  fetch('https://tpapi.trainingpeaks.com/users/v3/token', { credentials: 'include' })
    .then(function (res) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', loggedIn: res.ok }));
    })
    .catch(function () {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', loggedIn: false }));
    });
})(); true;`;

// Token from the session cookie → athleteId → this week's workouts,
// filtered to swims (workoutTypeValueId 1) that have a description.
const weekJs = (startDay: string, endDay: string) => `(function () {
  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  fetch('https://tpapi.trainingpeaks.com/users/v3/token', { credentials: 'include' })
    .then(function (res) {
      if (!res.ok) throw new Error('token HTTP ' + res.status);
      return res.json();
    })
    .then(function (tokenJson) {
      var token = (tokenJson && tokenJson.token && tokenJson.token.access_token) ||
        (tokenJson && tokenJson.access_token);
      if (!token) throw new Error('access_token ausente');
      var headers = { authorization: 'Bearer ' + token, accept: 'application/json' };
      return fetch('https://tpapi.trainingpeaks.com/users/v3/user', { headers: headers })
        .then(function (res) {
          if (!res.ok) throw new Error('user HTTP ' + res.status);
          return res.json();
        })
        .then(function (userJson) {
          var athleteId = null;
          try { athleteId = userJson.user.athletes[0].athleteId; } catch (e) {}
          if (!athleteId) { try { athleteId = userJson.athletes[0].athleteId; } catch (e) {} }
          if (!athleteId) { try { athleteId = userJson.user.personId; } catch (e) {} }
          if (!athleteId) throw new Error('athleteId não encontrado');
          return fetch(
            'https://tpapi.trainingpeaks.com/fitness/v7/athletes/' + athleteId +
              '/workouts/${startDay}/${endDay}',
            { headers: headers }
          );
        })
        .then(function (res) {
          if (!res.ok) throw new Error('workouts HTTP ' + res.status);
          return res.json();
        })
        .then(function (workouts) {
          var swims = (workouts || [])
            .filter(function (w) { return w.workoutTypeValueId === 1 && w.description; })
            .map(function (w) {
              return {
                day: String(w.workoutDay || '').slice(0, 10),
                title: w.title || 'Natação',
                distance: Math.round(w.distancePlanned || w.distance || 0),
                description: w.description,
              };
            });
          post({ type: 'week', ok: true, workouts: swims });
        });
    })
    .catch(function (error) {
      post({ type: 'week', ok: false, error: String(error) });
    });
})(); true;`;

export const TrainingPeaksConnect = forwardRef<TrainingPeaksConnectHandle, Props>(
  ({ onStatus, onWeek }, ref) => {
    const webview = useRef<WebView>(null);
    const [visible, setVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useImperativeHandle(ref, () => ({
      fetchWeek(startDay, endDay) {
        webview.current?.injectJavaScript(weekJs(startDay, endDay));
      },
      showLogin() {
        setVisible(true);
        webview.current?.reload();
      },
      logout() {
        webview.current?.injectJavaScript(
          "window.location.href = 'https://home.trainingpeaks.com/logout'; true;"
        );
      },
    }));

    const handleMessage = (raw: string) => {
      let message: { type: string; loggedIn?: boolean } & WeekResult;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.type === "state") {
        if (message.loggedIn) {
          setVisible(false);
          onStatus("ready");
        } else {
          onStatus("login");
        }
      } else if (message.type === "week") {
        onWeek(message);
      }
    };

    return (
      <View
        style={
          visible
            ? [styles.fullscreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]
            : styles.hidden
        }
        pointerEvents={visible ? "auto" : "none"}
      >
        {visible && (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Entrar no TrainingPeaks</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={12}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>
        )}
        <WebView
          ref={webview}
          source={{ uri: TP_URL }}
          injectedJavaScript={PROBE_JS}
          onLoadEnd={() => webview.current?.injectJavaScript(PROBE_JS)}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          style={styles.webview}
          sharedCookiesEnabled
        />
      </View>
    );
  }
);

TrainingPeaksConnect.displayName = "TrainingPeaksConnect";

const styles = StyleSheet.create({
  fullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  // full-size but parked off-screen, so the page keeps a real viewport
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    transform: [{ translateX: -10000 }],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  headerTitle: {
    fontWeight: "600",
  },
  close: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
});
