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
import { AppsService } from "./services/AppsService";
import { getHwid, getHwidSync } from "./utils/hwid";
import type {
  SendOptions,
  RecordModel,
  CollectionModel,
  CommonOptions,
  AppUpdateCheckOptions,
  AppUpdateCheckResult,
  HwidOptions,
  ClientOptions,
} from "./types";

export class AlsaBase {
  baseUrl: string;
  authStore: BaseAuthStore;
  timeout: number = 0;

  readonly superusers: SuperuserService;
  readonly collections: CollectionService;
  readonly logs: LogService;
  readonly realtime: RealtimeService;
  readonly files: FileService;
  readonly hooks: HooksService;
  readonly apps: AppsService;

  private recordServices: Map<string, RecordService<any>> = new Map();
  private cancelControllers: Map<string, AbortController> = new Map();

  constructor(
    baseUrl: string = "/",
    authStore?: BaseAuthStore,
    options?: ClientOptions | number
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authStore =
      authStore ||
      (typeof window !== "undefined" ? new LocalAuthStore() : new BaseAuthStore());

    if (typeof options === "number") {
      this.timeout = options;
    } else if (options && typeof options === "object") {
      this.timeout = options.timeout || 0;
    } else {
      this.timeout = 0;
    }

    this.superusers = new SuperuserService(this);
    this.collections = new CollectionService(this);
    this.logs = new LogService(this);
    this.realtime = new RealtimeService(this);
    this.files = new FileService(this);
    this.hooks = new HooksService(this);
    this.apps = new AppsService(this);
  }

  /**
   * Alias for superusers service (admins)
   */
  get admins(): SuperuserService {
    return this.superusers;
  }

  /**
   * Check if an update is available for a specific application.
   * Compares the app's current version against published versions and evaluates
   * platform and channel rules.
   *
   * @param appSlug App identifier/slug
   * @param options Update check options (currentVersion, platform, channel)
   */
  async checkAppUpdate(
    appSlug: string,
    options: AppUpdateCheckOptions
  ): Promise<AppUpdateCheckResult> {
    return this.apps.checkUpdate(appSlug, options);
  }

  /**
   * Generates an always-consistent, persistent Hardware ID (HWID) / Device ID
   * for the current machine or client environment.
   *
   * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
   */
  async getHwid(optionsOrSlug?: string | HwidOptions): Promise<string> {
    return getHwid(optionsOrSlug);
  }

  /**
   * Synchronously generates an always-consistent, persistent Hardware ID (HWID) / Device ID.
   *
   * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
   */
  getHwidSync(optionsOrSlug?: string | HwidOptions): string {
    return getHwidSync(optionsOrSlug);
  }

  /**
   * Static helper: Generates an always-consistent, persistent Hardware ID (HWID) / Device ID.
   *
   * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
   */
  static async getHwid(optionsOrSlug?: string | HwidOptions): Promise<string> {
    return getHwid(optionsOrSlug);
  }

  /**
   * Static helper: Synchronously generates an always-consistent Hardware ID (HWID) / Device ID.
   *
   * @param optionsOrSlug Optional application slug (string) or HwidOptions configuration object
   */
  static getHwidSync(optionsOrSlug?: string | HwidOptions): string {
    return getHwidSync(optionsOrSlug);
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

    const effectiveTimeout = options.timeout ?? this.timeout ?? 0;
    let timeoutTimer: any = null;
    let timedOut = false;

    if (!controller && (effectiveTimeout > 0 || options.signal)) {
      controller = new AbortController();
    }

    if (effectiveTimeout > 0 && controller) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        controller?.abort(new Error(`Request timed out after ${effectiveTimeout}ms`));
      }, effectiveTimeout);
    }

    if (options.signal && controller) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener("abort", () => {
          controller?.abort(options.signal?.reason);
        });
      }
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

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

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
        let errorData = data;
        if (response.status === 499) {
          errorData = {
            message:
              "Client Closed Request (Status 499). The upload connection was closed prematurely. If you are uploading a large binary (>10MB), increase the client timeout (e.g. { timeout: 600000 }), use uploadVersionBinary() streaming, and ensure reverse proxies (such as Nginx) have 'client_max_body_size 500M;' and 'proxy_read_timeout 600s;' configured.",
            original: data,
          };
        }
        throw new ClientResponseError({
          url,
          status: response.status,
          data: errorData,
          response,
        });
      }

      return data as T;
    } catch (err: any) {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

      if (requestKey) {
        this.cancelControllers.delete(requestKey);
      }

      if (timedOut) {
        throw new ClientResponseError({
          url,
          status: 408,
          data: {
            message: `Request timed out after ${effectiveTimeout}ms. For large installer uploads, increase the timeout (e.g. { timeout: 600000 }) or use uploadVersionBinary() streaming.`,
            isTimeout: true,
          },
          originalError: err,
        });
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
