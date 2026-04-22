const REQUIRED_SERVER_VARS = [
  "CRON_SECRET",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

export function validateEnv(): void {
  if (typeof window !== "undefined") return; // server-side only

  const missing = REQUIRED_SERVER_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[ENV CHECK] Missing critical environment variables: ${missing.join(", ")}`
    );
  }
}
