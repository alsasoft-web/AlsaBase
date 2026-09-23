import { BaseAuthStore } from "./stores/BaseAuthStore";
import { LocalAuthStore } from "./stores/LocalAuthStore";
import { ClientResponseError } from "./ClientResponseError";
import { RecordService } from "./services/RecordService";
import { CollectionService } from "./services/CollectionService";
import { SuperuserService } from "./services/SuperuserService";
import { LogService } from "./services/LogService";
import { RealtimeService } from "./services/RealtimeService";
import { FileService } from "./services/FileService";
import { HooksService } from "./services/HooksService";
import type { SendOptions, RecordModel, CollectionModel, CommonOptions } from "./types";

export class AlsaBase {
  baseUrl: string;
  authStore: BaseAuthStore;

  readonly superusers: SuperuserService;
  readonly collections: CollectionService;
  readonly logs: LogService;
  readonly realtime: RealtimeService;
  readonly files: FileService;
  readonly hooks: HooksService;

  private recordServices: Map<string, RecordService<any>> = new Map();
  private cancelControllers: Map<string, AbortController> = new Map();

  constructor(
    baseUrl: string = "/",
    authStore?: BaseAuthStore
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authStore =
      authStore ||
      (typeof window !== "undefined" ? new LocalAuthStore() : new BaseAuthStore());

    this.superusers = new SuperuserService(this);
    this.collections = new CollectionService(this);
    this.logs = new LogService(this);
    this.realtime = new RealtimeService(this);
    this.files = new FileService(this);
    this.hooks = new HooksService(this);
  }

  /**
   * Alias for superusers service (admins)
   */
  get admins(): SuperuserService {
    return this.superusers;
  }

  /**
   * Returns a RecordService instance for the specified collection
   */
  collection<T = RecordModel>(idOrName: string): RecordService<T> {
    if (!this.recordServices.has(idOrName)) {
      this.recordServices.set(
        idOrName,
        new RecordService<T>(this, idOrName)
      );
    }
    return this.recordServices.get(idOrName)! as RecordService<T>;
  }

  /**
   * Returns the schema and column definitions for a table/collection (Requires Superuser authentication)
   */
  async getSchema(idOrName: string, options?: CommonOptions): Promise<CollectionModel> {
    return this.collections.getOne(idOrName, options);
  }

  /**
   * Returns the schema and column definitions for a table/collection (Requires Superuser authentication)
   * Alias for getSchema()
   */
  async getTableSchema(idOrName: string, options?: CommonOptions): Promise<CollectionModel> {
    return this.collections.getOne(idOrName, options);
  }

  /**
   * Helper to format filter expression string with parameterized values
   */
  filter(expr: string, params: Record<string, any> = {}): string {
    if (!params || Object.keys(params).length === 0) {
      return expr;
    }

    let result = expr;
    for (const [key, val] of Object.entries(params)) {
      let formattedVal: string;
      if (val === null || val === undefined) {
        formattedVal = "null";
      } else if (typeof val === "number" || typeof val === "boolean") {
        formattedVal = String(val);
      } else if (val instanceof Date) {
        formattedVal = `"${val.toISOString()}"`;
      } else {
        formattedVal = `"${String(val).replace(/"/g, '\\"')}"`;
      }

      const pattern = new RegExp(`{:?\\b${key}\\b}`, "g");
      result = result.replace(pattern, formattedVal);
    }

    return result;
  }

  /**
   * Cancels a pending request with matching requestKey
   */
  cancelRequest(requestKey: string): this {
    const controller = this.cancelControllers.get(requestKey);
    if (controller) {
      controller.abort();
      this.cancelControllers.delete(requestKey);
    }
    return this;
  }

  /**
   * Cancels all pending requests
   */
  cancelAllRequests(): this {
    for (const controller of this.cancelControllers.values()) {
      controller.abort();
    }
    this.cancelControllers.clear();
    return this;
  }

  /**
   * Builds an absolute URL with query parameters
   */
  buildUrl(path: string, query?: Record<string, any>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.baseUrl}${cleanPath}`;

    if (query && Object.keys(query).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    return url;
  }

  /**
   * Dispatches an HTTP request to the AlsaBase server
   */
  async send<T = any>(path: string, options: SendOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query || options.params);

    // Auto-cancellation handling
    let requestKey = options.requestKey;
    if (requestKey === undefined && options.autoCancel !== false && (options.method === "GET" || !options.method)) {
      requestKey = `${options.method || "GET"} ${url}`;
    }

    let controller: AbortController | undefined;
    if (requestKey) {
      this.cancelRequest(requestKey);
      controller = new AbortController();
      this.cancelControllers.set(requestKey, controller);
    }

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    // Attach Authorization header if authenticated and not already provided
    if (!headers["Authorization"] && !headers["authorization"] && this.authStore.token) {
      headers["Authorization"] = `Bearer ${this.authStore.token}`;
    }

    let body = options.body;
    // Auto stringify plain objects if not FormData/Blob/Buffer
    if (
      body !== undefined &&
      body !== null &&
      typeof body === "object" &&
      typeof (body as any).append !== "function" &&
      !(typeof Blob !== "undefined" && body instanceof Blob) &&
      !(typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer)
    ) {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(body);
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
      body,
      signal: controller ? controller.signal : options.signal,
    };

    try {
      const response = await fetch(url, fetchOptions);

      if (requestKey) {
        this.cancelControllers.delete(requestKey);
      }

      // Parse response JSON or text
      let data: any = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json().catch(() => null);
      } else {
        data = await response.text().catch(() => null);
      }

      if (!response.ok) {
        throw new ClientResponseError({
          url,
          status: response.status,
          data,
          response,
        });
      }

      return data as T;
    } catch (err: any) {
      if (requestKey) {
        this.cancelControllers.delete(requestKey);
      }

      if (err.name === "AbortError") {
        throw new ClientResponseError({
          url,
          status: 0,
          data: { message: "The request was autocancelled or aborted." },
          isAbort: true,
          originalError: err,
        });
      }

      if (err instanceof ClientResponseError) {
        throw err;
      }

      throw new ClientResponseError({
        url,
        status: 0,
        data: { message: err.message },
        originalError: err,
      });
    }
  }
}

export type Client = AlsaBase;
