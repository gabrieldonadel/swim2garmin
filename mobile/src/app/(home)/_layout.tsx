import { Stack } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

function HeaderTitle() {
  return (
    <View style={styles.title}>
      <Image source={require("../../../assets/images/rounded-logo.png")} style={styles.logo} />
      <Text style={styles.text}>Swim2Garmin</Text>
    </View>
  );
}

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: () => <HeaderTitle /> }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  title: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#0d9488",
  },
  text: {
    fontSize: 17,
    fontWeight: "600",
  },
});
