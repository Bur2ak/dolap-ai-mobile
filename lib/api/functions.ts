import type { FunctionInvokeOptions } from "@supabase/functions-js";

import { captureError } from "@/lib/observability";
import { supabase } from "@/lib/supabase";

const maxAttempts = 3;
const baseDelayMs = 600;

export async function invokeFunctionWithRetry<T>(name: string, body: FunctionInvokeOptions["body"]): Promise<T | null> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Awaited<ReturnType<typeof supabase.functions.invoke<T>>>;
    try {
      response = await supabase.functions.invoke<T>(name, { body });
    } catch (error) {
      const functionError = new EdgeFunctionError(getFunctionErrorMessage(name, undefined, null, error));
      lastError = functionError;
      captureError(functionError, { area: "edge_function", function_name: name, attempt, status: null });

      if (attempt < maxAttempts && shouldRetryFunctionError(functionError)) {
        await delay(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      break;
    }

    const { data, error } = response;

    if (!error) {
      return data ?? null;
    }

    const functionError = await normalizeFunctionError(name, error);
    lastError = functionError;
    captureError(functionError, { area: "edge_function", function_name: name, attempt, status: functionError.status ?? null });

    if (attempt < maxAttempts && shouldRetryFunctionError(functionError)) {
      await delay(baseDelayMs * 2 ** (attempt - 1));
      continue;
    }

    break;
  }

  throw lastError instanceof Error ? lastError : new Error(`${name} fonksiyonu yanit vermedi.`);
}

export class EdgeFunctionError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = "EdgeFunctionError";
    this.code = options?.code;
    this.status = options?.status;
  }
}

async function normalizeFunctionError(name: string, error: unknown) {
  const status = getErrorStatus(error);
  const payload = await readErrorPayload(error);
  const message = getFunctionErrorMessage(name, status, payload, error);
  const code = typeof payload?.code === "string" ? payload.code : undefined;

  return new EdgeFunctionError(message, { code, status });
}

function shouldRetryFunctionError(error: EdgeFunctionError) {
  if (!error.status) {
    return true;
  }

  return error.status === 408 || error.status === 429 || error.status >= 500;
}

function getFunctionErrorMessage(name: string, status: number | undefined, payload: Record<string, unknown> | null, error: unknown) {
  const payloadMessage = [payload?.message, payload?.error, payload?.reason].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (payloadMessage) {
    return payloadMessage;
  }

  if (status === 401 || status === 403) {
    return `${name} icin yetki dogrulanamadi. Supabase session veya function secret ayarlarini kontrol et.`;
  }

  if (status === 404) {
    return `${name} fonksiyonu bulunamadi. Supabase deploy durumunu kontrol et.`;
  }

  if (status === 429) {
    return `${name} gecici limit verdi. Biraz sonra tekrar dene.`;
  }

  if (status && status >= 500) {
    return `${name} su anda yanit veremiyor. Supabase function loglarini kontrol et.`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return `${name} fonksiyonu yanit vermedi.`;
}

function getErrorStatus(error: unknown) {
  const context = getErrorContext(error);
  const status = typeof context?.status === "number" ? context.status : undefined;
  return status;
}

async function readErrorPayload(error: unknown): Promise<Record<string, unknown> | null> {
  const context = getErrorContext(error);
  if (!context || typeof context.json !== "function") {
    return null;
  }

  try {
    const payload = (await context.json()) as unknown;
    return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function getErrorContext(error: unknown): Response | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
