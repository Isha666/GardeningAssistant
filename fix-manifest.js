const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function fixManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    // Tell Android we are using the 'tools' modifier
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    // Inject the tools:replace rule that the error asked for
    if (app.$["tools:replace"]) {
      if (!app.$["tools:replace"].includes("android:appComponentFactory")) {
        app.$["tools:replace"] += ",android:appComponentFactory";
      }
    } else {
      app.$["tools:replace"] = "android:appComponentFactory";
    }

    return config;
  });
};
