const requiredEnvVars = {
  POSTGRES_HOST: "PostgreSQL host",
  POSTGRES_USER: "PostgreSQL user",
  POSTGRES_DATABASE: "PostgreSQL database",
  POSTGRES_PASSWORD: "PostgreSQL password",
  JWT_SECRET: "JWT signing secret (32+ chars)",
  UPLOADTHING_TOKEN: "UploadThing API token",
  DISCORD_CLIENT_ID: "Discord OAuth client ID",
  DISCORD_CLIENT_SECRET: "Discord OAuth client secret",
  DISCORD_REDIRECT_URI: "Discord OAuth redirect URI",
  CLIENT_URL: "Client URL (e.g., https://yourdomain.com)",
  TURNSTILE_SECRET: "Turnstile secret key",
  NEXT_PUBLIC_TURNSTILE_SITEKEY: "Turnstile site key",
} as const;

const optionalEnvVars = {
  POSTGRES_PORT: "PostgreSQL port (default: 6543)",
  POSTGRES_CA: "PostgreSQL CA cert for TLS",
  DISCORD_GUILD_EXCELSIOR_ID: "Discord Excelsior guild ID",
  DISCORD_GUILD_COSMOTEER_ID: "Discord Cosmoteer guild ID",
  ADMIN_USERNAMES: "Comma-separated admin usernames",
} as const;

function validateEnv(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const [key, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(`${key} (${description})`);
    } else if (key === "JWT_SECRET" && value.length < 32) {
      invalid.push(`${key}: must be at least 32 characters`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join("\n")}`
    );
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid environment variables:\n${invalid.map((i) => `  - ${i}`).join("\n")}`);
  }

  for (const [key, description] of Object.entries(optionalEnvVars)) {
    if (!process.env[key]) {
      console.warn(`[env] Optional variable not set: ${key} (${description})`);
    }
  }

  console.log("[env] All required environment variables validated successfully");
}

if (typeof window === "undefined") {
  validateEnv();
}

export { requiredEnvVars, optionalEnvVars, validateEnv };