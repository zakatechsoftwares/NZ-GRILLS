// Extends app.json. Android push (FCM) needs google-services.json from Firebase:
// - local builds: place it at ./google-services.json (gitignored)
// - EAS/CI builds: GOOGLE_SERVICES_JSON file environment variable on EAS
// Android maps need GOOGLE_MAPS_API_KEY (environment variable on EAS). Without it the
// app shows MapPlaceholder instead of MapView, which would crash with no key.
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile && { googleServicesFile }),
      ...(googleMapsApiKey && { config: { googleMaps: { apiKey: googleMapsApiKey } } }),
    },
    extra: {
      ...config.extra,
      mapsEnabled: !!googleMapsApiKey,
    },
  };
};
