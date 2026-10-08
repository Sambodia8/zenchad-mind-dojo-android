import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zenchad.minddojo",
  appName: "Neural Fantasy",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#080d1b"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: "#080d1b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#b7adff",
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
