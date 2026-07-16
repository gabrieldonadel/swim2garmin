import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export type GarminStatus = "loading" | "login" | "ready";

export interface SendResult {
  ok: boolean;
  status: number;
  body: string;
  /** id of the created workout, for linking to it */
  workoutId?: number;
  /** present only when a calendar date was requested */
  scheduled?: boolean;
  scheduleBody?: string;
}

export interface GarminConnectHandle {
  sendWorkout(payload: object, scheduleDate?: string): void;
  showLogin(): void;
  logout(): void;
}

interface Props {
  onStatus(status: GarminStatus): void;
  onResult(result: SendResult): void;
}

const GARMIN_URL = "https://connect.garmin.com/modern/workouts";

// Polls the page for the csrf-token meta tag (the SPA may add it after load)
// and reports where we ended up — connect.garmin.com means logged in,
// sso.garmin.com means the user needs to sign in.
const PROBE_JS = `(function () {
  var tries = 0;
  function check() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    var hasCsrf = !!(meta && meta.getAttribute('content'));
    if (hasCsrf || tries++ > 20) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'state', host: location.host, hasCsrf: hasCsrf })
      );
    } else {
      setTimeout(check, 250);
    }
  }
  check();
})(); true;`;

// Same call the browser extension makes, but POST to create a new workout
// instead of editing an existing one. Runs in the page context, so the
// session cookies and CSRF token are the real ones. When scheduleDate
// ('YYYY-MM-DD') is given, the created workout is then put on the calendar.
const sendJs = (payload: object, scheduleDate?: string) => `(function () {
  var meta = document.querySelector('meta[name="csrf-token"]');
  var csrf = meta && meta.getAttribute('content');
  function report(result) {
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
  }
  if (!csrf) {
    report({ type: 'result', ok: false, status: 0, body: 'Sem token CSRF — entre novamente' });
    return;
  }
  var headers = {
    accept: '*/*',
    'content-type': 'application/json;charset=UTF-8',
    'connect-csrf-token': csrf,
  };
  fetch('https://connect.garmin.com/gc-api/workout-service/workout', {
    method: 'POST',
    headers: headers,
    credentials: 'include',
    body: JSON.stringify(${JSON.stringify(payload).replace(/[\u2028\u2029]/g, "")}),
  })
    .then(function (res) {
      return res.text().then(function (text) {
        var workoutId = null;
        try { workoutId = JSON.parse(text).workoutId; } catch (e) {}
        var scheduleDate = ${JSON.stringify(scheduleDate ?? null)};
        if (!res.ok || !scheduleDate) {
          report({ type: 'result', ok: res.ok, status: res.status, body: text.slice(0, 500), workoutId: workoutId });
          return;
        }
        if (!workoutId) {
          report({ type: 'result', ok: true, status: res.status, body: '', scheduled: false, scheduleBody: 'resposta sem workoutId' });
          return;
        }
        fetch('https://connect.garmin.com/gc-api/workout-service/schedule/' + workoutId, {
          method: 'POST',
          headers: headers,
          credentials: 'include',
          body: JSON.stringify({ date: scheduleDate }),
        })
          .then(function (scheduleRes) {
            return scheduleRes.text().then(function (scheduleText) {
              report({
                type: 'result', ok: true, status: res.status, body: '', workoutId: workoutId,
                scheduled: scheduleRes.ok, scheduleBody: scheduleText.slice(0, 300),
              });
            });
          })
          .catch(function (error) {
            report({ type: 'result', ok: true, status: res.status, body: '', workoutId: workoutId, scheduled: false, scheduleBody: String(error) });
          });
      });
    })
    .catch(function (error) {
      report({ type: 'result', ok: false, status: 0, body: String(error) });
    });
})(); true;`;

export const GarminConnect = forwardRef<GarminConnectHandle, Props>(
  ({ onStatus, onResult }, ref) => {
    const webview = useRef<WebView>(null);
    const [visible, setVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useImperativeHandle(ref, () => ({
      sendWorkout(payload, scheduleDate) {
        webview.current?.injectJavaScript(sendJs(payload, scheduleDate));
      },
      showLogin() {
        setVisible(true);
        webview.current?.reload();
      },
      logout() {
        // navigating to the site's logout kills the session cookies;
        // the load-end probe then reports "login"
        webview.current?.injectJavaScript(
          "window.location.href = 'https://connect.garmin.com/modern/auth/logout'; true;"
        );
      },
    }));

    const handleMessage = (raw: string) => {
      let message: { type: string; host?: string; hasCsrf?: boolean } & SendResult;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.type === "state") {
        if (message.hasCsrf) {
          setVisible(false);
          onStatus("ready");
        } else if (message.host?.includes("sso.garmin")) {
          onStatus("login");
        } else {
          onStatus("loading");
        }
      } else if (message.type === "result") {
        onResult(message);
      }
    };

    // The WebView stays mounted (and 1px) so cookies/CSRF are always live;
    // it expands to full screen only while the user signs in.
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
            <Text style={styles.headerTitle}>Entrar no Garmin Connect</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={12}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>
        )}
        <WebView
          ref={webview}
          source={{ uri: GARMIN_URL }}
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

GarminConnect.displayName = "GarminConnect";

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
  // (a 1x1 WebView makes the site lay out against a 1px-wide viewport → huge zoom)
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
