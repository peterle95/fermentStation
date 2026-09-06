/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.peterle.fermentstation",
  appName: "FermentStation",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_fermentstation",
      iconColor: "#9D4934",
    },
  },
};

export default config;
