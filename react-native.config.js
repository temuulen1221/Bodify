/**
 * Provide explicit react-native config for autolinking.
 * Some autolinking flows expect project.android.packageName to be present
 * in react-native config output. Adding this file ensures Gradle can
 * discover the Android package name reliably.
 */
module.exports = {
  project: {
    android: {
      packageName: 'com.temuulen1221.bodify',
    },
  },
};
