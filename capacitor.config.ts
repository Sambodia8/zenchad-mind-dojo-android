import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zenchad.minddojo",
  appName: "ZenChad",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0b1020"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: "#0b1020",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#26c485",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
