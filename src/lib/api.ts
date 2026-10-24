import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError } from "./auth";
import { redactSecrets } from "./crypto";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, code = "bad_request"): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof ApiError) return fail(error.message, error.status, error.code);
  if (error instanceof AuthError) return fail(error.message, error.status, "auth_error");
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return fail(first?.message ?? "Invalid request payload.", 422, "validation_error");
  }
  const status = (error as any)?.status as number | undefined;
  if (status === 429) return fail(String((error as Error).message), 429, "rate_limited");
  const message = redactSecrets(
    error instanceof Error ? error.message : "Unexpected server error.",
  );
  console.error("[api]", message);
  const safeStatus = status && status >= 400 && status < 600 ? status : 500;
  return fail(safeStatus === 500 ? message : message, safeStatus, "server_error");
}

/** Wrap a route handler with consistent error handling. */
export function route<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON.", 400);
  }
  return schema.parse(body);
}

export function getSearchParam(request: Request, name: string): string | undefined {
  const value = new URL(request.url).searchParams.get(name);
  return value === null || value === "" ? undefined : value;
}

export function requireSearchParam(request: Request, name: string): string {
  const value = getSearchParam(request, name);
  if (!value) throw new ApiError(`Missing required query parameter: ${name}`, 400);
  return value;
}
