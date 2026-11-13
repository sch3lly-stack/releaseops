import { healthResponseSchema, type HealthResponse } from "@releaseops/shared";

export function apiBaseUrl(env: ImportMetaEnv = import.meta.env): string {
  const configured = env.VITE_API_URL?.trim();
  return configured && configured.length > 0 ? configured : "http://localhost:3001";
}

export async function fetchHealth(baseUrl = apiBaseUrl()): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/healthz`);
  } catch {
    throw new Error(`API unreachable at ${baseUrl}`);
  }

  if (!response.ok) {
    throw new Error(`API health check failed (${response.status})`);
  }

  return healthResponseSchema.parse(await response.json());
}
