import { NativeTabs } from "expo-router/unstable-native-tabs";

import { AccountsProvider } from "@/components/accounts-context";

export default function RootLayout() {
  return (
    <AccountsProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Icon sf="figure.pool.swim" md="pool" />
          <NativeTabs.Trigger.Label>Treino</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(settings)">
          <NativeTabs.Trigger.Icon sf="gear" md="settings" />
          <NativeTabs.Trigger.Label>Configurações</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </AccountsProvider>
  );
}
