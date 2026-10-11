// Extends app.json. Android push (FCM) needs google-services.json from Firebase:
// - local builds: place it at ./google-services.json (gitignored)
// - EAS/CI builds: GOOGLE_SERVICES_JSON file environment variable on EAS
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile && { googleServicesFile }),
    },
  };
};
