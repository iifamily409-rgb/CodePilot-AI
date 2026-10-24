import { json, route } from "@/lib/api";
import { one } from "@/lib/db";
import { executionEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  let database = "ok";
  try {
    one("SELECT 1 AS ok");
  } catch {
    database = "unavailable";
  }
  return json({
    status: database === "ok" ? "ok" : "degraded",
    database,
    executionEnabled: executionEnv().enabled,
    time: new Date().toISOString(),
  });
});
