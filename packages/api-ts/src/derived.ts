import Ajv from "ajv";
import schema from "../../../contracts/derived-v1.schema.json";
import type { ApiClient } from "./client";
export type {
  PersonalContext,
  CandidateView,
  TodoView,
  RunView,
  DailyView,
  TodayView,
  ReviewPreferences,
  Due,
  ContextEvidence,
  CitedText,
} from "./derived-schema";
const ajv = new Ajv({ strict: false });
ajv.addSchema(schema);

export function assertDerived<T>(
  name: string,
  value: unknown,
): asserts value is T {
  const validate = ajv.getSchema(schema.$id + "#/definitions/" + name);
  if (!validate?.(value)) throw new Error("Invalid " + name + " response");
  // A bodyless state must stay bodyless, even if a buggy server includes optional fields.
  const item = value as Record<string, unknown>;
  if (
    (name === "TodoView" && item.source_state !== "available") ||
    (["RunView", "DailyView"].includes(name) && item.status !== "ready")
  ) {
    if (
      ["action", "due", "evidence", "result", "sections", "expires_at"].some(
        (k) => item[k] != null,
      )
    )
      throw new Error("Unavailable response contains protected data");
  }
  if (name === "TodayView") {
    for (const v of item.todos as unknown[]) assertDerived("TodoView", v);
    for (const v of item.daily_reviews as unknown[])
      assertDerived("DailyView", v);
  }
}

export async function derivedGet<T>(
  api: ApiClient,
  path: string,
  name: string,
): Promise<T> {
  const value = await api.request<unknown>(path);
  assertDerived<T>(name, value);
  return value;
}

export async function derivedList<T>(
  api: ApiClient,
  path: string,
  name: string,
): Promise<T[]> {
  const value = await api.request<unknown>(path);
  if (!Array.isArray(value)) throw new Error("Invalid list response");
  value.forEach((item) => assertDerived<T>(name, item));
  return value as T[];
}
