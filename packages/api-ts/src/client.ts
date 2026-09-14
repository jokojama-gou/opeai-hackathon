import { assertModel } from "./validate";
import type {
  Recording,
  Source,
  Job,
  ProcessingPolicy,
  ConnectionSnapshot,
} from "./schema";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryable = false,
  ) {
    super(code);
  }
}
export type Mutation = { request_key: string; expected_version: number };
export type TokenProvider = () => Promise<string | null>;
export class ApiClient {
  constructor(
    private baseUrl: string,
    private token: TokenProvider,
    private transport: typeof fetch = fetch,
  ) {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("API connection requires HTTPS");
    if (url.username || url.password || url.search || url.hash)
      throw new Error("Invalid API URL");
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!path.startsWith("/v1/") || path.includes("://"))
      throw new Error("Invalid API path");
    const token = await this.token();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.transport(this.baseUrl + path, {
        method,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          code?: string;
          retryable?: boolean;
        };
        throw new ApiError(
          response.status,
          error.code ?? "request_failed",
          error.retryable === true,
        );
      }
      return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // An interrupted mutation may have reached the server. The caller retains its key.
      throw new ApiError(
        0,
        method === "GET" ? "connection_unavailable" : "result_unknown",
        false,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async recordings(): Promise<Recording[]> {
    const values = await this.request<unknown[]>("/v1/recordings");
    if (!Array.isArray(values)) throw new Error("Invalid recordings response");
    values.forEach((value) => assertModel<Recording>("Recording", value));
    return values as Recording[];
  }
  async sources(id: string): Promise<Source[]> {
    const values = await this.request<unknown[]>(
      `/v1/recordings/${encodeURIComponent(id)}/sources`,
    );
    if (!Array.isArray(values)) throw new Error("Invalid sources response");
    values.forEach((value) => assertModel<Source>("Source", value));
    return values as Source[];
  }
  async policy(): Promise<ProcessingPolicy> {
    const value = await this.request<unknown>("/v1/processing-policy");
    assertModel<ProcessingPolicy>("ProcessingPolicy", value);
    return value;
  }
  async job(id: string): Promise<Job> {
    const value = await this.request<unknown>(
      `/v1/jobs/${encodeURIComponent(id)}`,
    );
    assertModel<Job>("Job", value);
    return value;
  }
  async connections(): Promise<ConnectionSnapshot[]> {
    const values = await this.request<unknown[]>("/v1/connections");
    if (!Array.isArray(values)) throw new Error("Invalid connections response");
    values.forEach((value) =>
      assertModel<ConnectionSnapshot>("ConnectionSnapshot", value),
    );
    return values as ConnectionSnapshot[];
  }
  async connection(id: string): Promise<ConnectionSnapshot> {
    const value = await this.request<unknown>(
      `/v1/connections/${encodeURIComponent(id)}`,
    );
    assertModel<ConnectionSnapshot>("ConnectionSnapshot", value);
    return value;
  }
}
