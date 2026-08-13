const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(`Missing required deployment secrets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Deployment environment is configured.");
