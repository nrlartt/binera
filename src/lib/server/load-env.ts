import { config } from "dotenv";

/** Loads .env.local for standalone scripts (seller, worker, deploy helpers). */
config({ path: process.env.ENV_FILE || ".env.local" });
