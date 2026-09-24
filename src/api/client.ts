import { io, Socket } from "socket.io-client";

export type FieldType =
  | "text"
  | "number"
  | "bool"
  | "json"
  | "date"
  | "autodate"
  | "file"
  | "email"
  | "url"
  | "select"
  | "relation";

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  presentable?: boolean;
  hidden?: boolean;
  helpText?: string;
  defaultValue?: any;
  min?: number;
  max?: number;
  noDecimal?: boolean;
  pattern?: string;
  autogeneratePattern?: string;
  maxSize?: number;
  maxSelect?: number;
  mimeTypes?: string[];
  thumbs?: string[];
  protected?: boolean;
  values?: string[];
  relationCollection?: string;
  onCreate?: boolean;
  onUpdate?: boolean;
  system?: boolean;
}

export interface CollectionRule {
  list?: "public" | "auth" | "admin" | string;
  view?: "public" | "auth" | "admin" | string;
  create?: "public" | "auth" | "admin" | string;
  update?: "public" | "auth" | "admin" | string;
  delete?: "public" | "auth" | "admin" | string;
  authWithPassword?: string;
  authRule?: string;
  manageRule?: string;
}

export interface CollectionDef {
  id: string;
  name: string;
  type?: "base" | "auth" | "view";
  fields: FieldDef[];
  rules: CollectionRule;
  indexes?: string[];
  options?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TableIndexInfo {
  name: string;
  tableName: string;
  unique: boolean;
  columns: string[];
  sql?: string;
  primaryKey?: boolean;
}

export interface HookRouteDef {
  method: string;
  path: string;
  authLevel: "public" | "auth" | "superuser";
  sourceFile: string;
}

export interface HookCronDef {
  name: string;
  schedule: string;
  sourceFile: string;
  active: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_duration_ms?: number | null;
}

export interface HookCommandOptionDef {
  name: string;
  flag?: string;
  param?: string;
  aliases?: string[];
  description?: string;
  type?: "string" | "boolean" | "number";
  default?: any;
}

export interface HookCommandDef {
  name: string;
  description: string;
  usage?: string;
  sourceFile: string;
  type: "script" | "custom";
  options?: HookCommandOptionDef[];
}

export interface HookFileItem {
  filename?: string;
  name?: string;
  sizeBytes: number;
  updatedAt: string;
  error?: string | null;
  errorLine?: number | null;
  errorCol?: number | null;
  errorSnippet?: string | null;
  errorStack?: string | null;
}

export interface HooksOverview {
  hooksDir: string;
  files: HookFileItem[];
  routes: HookRouteDef[];
  crons: HookCronDef[];
  commands: HookCommandDef[];
  totalFiles: number;
  totalRoutes: number;
  totalCrons: number;
  totalCommands: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
  metadata_json?: string;
}

export interface PaginatedResult<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

const API_BASE = "/api";

function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem("alsabase_token") ||
    localStorage.getItem("AlsaBase_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async hasInitialSuperuser() {
    return request<{ hasSuperuser: boolean }>("/auth/superusers/has-initial");
  },

  async setupInitialSuperuser(email: string, password: string) {
    const res = await request<{ token: string; user: any }>(
      "/auth/superusers/setup",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    localStorage.setItem("alsabase_token", res.token);
    localStorage.setItem("alsabase_user", JSON.stringify(res.user));
    localStorage.setItem("AlsaBase_token", res.token);
    localStorage.setItem("AlsaBase_user", JSON.stringify(res.user));
    return res;
  },

  async loginSuperuser(email: string, password: string) {
    const res = await request<{ token: string; user: any }>(
      "/auth/superusers/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    localStorage.setItem("alsabase_token", res.token);
    localStorage.setItem("alsabase_user", JSON.stringify(res.user));
    localStorage.setItem("AlsaBase_token", res.token);
    localStorage.setItem("AlsaBase_user", JSON.stringify(res.user));
    return res;
  },

  async getSuperusers() {
    return request<{ items: any[]; total: number }>("/auth/superusers");
  },

  async createSuperuser(data: { email: string; password: string }) {
    return request<any>("/auth/superusers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSuperuser(id: string, data: { email?: string; password?: string }) {
    return request<any>(`/auth/superusers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteSuperuser(id: string) {
    return request<{ success: boolean; id: string }>(`/auth/superusers/${id}`, {
      method: "DELETE",
    });
  },

  async loginUser(identity: string, password: string) {
    const res = await request<{ token: string; user: any }>(
      "/auth/users/login",
      {
        method: "POST",
        body: JSON.stringify({ identity, password }),
      },
    );
    localStorage.setItem("alsabase_token", res.token);
    localStorage.setItem("alsabase_user", JSON.stringify(res.user));
    localStorage.setItem("AlsaBase_token", res.token);
    localStorage.setItem("AlsaBase_user", JSON.stringify(res.user));
    return res;
  },

  async getMe() {
    return request<any>("/auth/superusers/me");
  },

  logout() {
    localStorage.removeItem("alsabase_token");
    localStorage.removeItem("alsabase_user");
    localStorage.removeItem("AlsaBase_token");
    localStorage.removeItem("AlsaBase_user");
  },

  // Health
  async getHealth() {
    return request<any>("/health");
  },

  // Collections Schema
  async listCollections() {
    return request<{ items: CollectionDef[]; total: number }>("/collections");
  },

  async createCollection(data: {
    name: string;
    type?: "base" | "auth" | "view";
    fields?: FieldDef[];
    rules?: CollectionRule;
    indexes?: string[];
    options?: Record<string, any>;
  }) {
    return request<CollectionDef>("/collections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateCollection(
    nameOrId: string,
    data: {
      name?: string;
      type?: "base" | "auth" | "view";
      fields?: FieldDef[];
      rules?: CollectionRule;
      indexes?: string[];
      options?: Record<string, any>;
    },
  ) {
    return request<CollectionDef>(`/collections/${nameOrId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteCollection(nameOrId: string) {
    return request<{ success: boolean }>(`/collections/${nameOrId}`, {
      method: "DELETE",
    });
  },

  async truncateCollection(nameOrId: string) {
    return request<{ success: boolean; changes?: number }>(
      `/collections/${nameOrId}/truncate`,
      {
        method: "DELETE",
      },
    );
  },

  // Table Indexes
  async getTableIndexes(collectionName: string) {
    return request<{ items: TableIndexInfo[]; total: number }>(
      `/collections/${collectionName}/indexes`,
    );
  },

  async createTableIndex(
    collectionName: string,
    data: { name?: string; columns?: string[]; unique?: boolean; rawSql?: string },
  ) {
    return request<{ name: string; sql: string }>(
      `/collections/${collectionName}/indexes`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async dropTableIndex(collectionName: string, indexName: string) {
    return request<{ success: boolean }>(
      `/collections/${collectionName}/indexes/${indexName}`,
      {
        method: "DELETE",
      },
    );
  },

  // Records CRUD
  async listRecords(
    collectionName: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.search) params.set("search", query.search);
    if (query.sort) params.set("sort", query.sort);

    return request<PaginatedResult<any>>(
      `/collections/${collectionName}/records?${params.toString()}`,
    );
  },

  async createRecord(collectionName: string, data: any) {
    return request<any>(`/collections/${collectionName}/records`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateRecord(collectionName: string, id: string, data: any) {
    return request<any>(`/collections/${collectionName}/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteRecord(collectionName: string, id: string) {
    return request<{ success: boolean; id: string }>(
      `/collections/${collectionName}/records/${id}`,
      {
        method: "DELETE",
      },
    );
  },

  // Hooks (_hooks Directory)
  async getHooksOverview() {
    return request<HooksOverview>("/hooks");
  },

  async listHookFiles() {
    return request<{ items: HookFileItem[]; total: number; hooksDir: string }>(
      "/hooks/files",
    );
  },

  async getHookFile(filename: string) {
    return request<{
      name: string;
      content: string;
      sizeBytes: number;
      updatedAt: string;
    }>(`/hooks/files/file?path=${encodeURIComponent(filename)}`);
  },

  async saveHookFile(name: string, content: string) {
    return request<{ name: string; saved: boolean; path: string }>(
      "/hooks/files",
      {
        method: "POST",
        body: JSON.stringify({ name, content }),
      },
    );
  },

  async renameHookFile(oldName: string, newName: string) {
    return request<{ success: boolean; oldName: string; newName: string }>(
      "/hooks/files/rename",
      {
        method: "POST",
        body: JSON.stringify({ oldName, newName }),
      },
    );
  },

  async copyHookFile(sourceName: string, targetName: string) {
    return request<{
      success: boolean;
      sourceName: string;
      targetName: string;
    }>("/hooks/files/copy", {
      method: "POST",
      body: JSON.stringify({ sourceName, targetName }),
    });
  },

  async createHookFolder(path: string) {
    return request<{ success: boolean; path: string }>("/hooks/files/folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  },

  async deleteHookFolder(path: string) {
    return request<{ success: boolean; message: string }>(
      `/hooks/files/folder?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      },
    );
  },

  async uploadHooksBatch(
    files: { path: string; content: string; isBase64?: boolean }[],
  ) {
    return request<{ success: boolean; count: number; saved: string[] }>(
      "/hooks/files/upload-batch",
      {
        method: "POST",
        body: JSON.stringify({ files }),
      },
    );
  },

  async deleteHookFile(filename: string) {
    return request<{ success: boolean; message: string }>(
      `/hooks/files/file?path=${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      },
    );
  },

  async reloadHooks() {
    return request<{ success: boolean; overview: HooksOverview }>(
      "/hooks/reload",
      {
        method: "POST",
      },
    );
  },

  async triggerCron(name: string) {
    return request<{
      success: boolean;
      durationMs: number;
      output?: string[];
      error?: string;
    }>(`/hooks/cron/${encodeURIComponent(name)}/trigger`, {
      method: "POST",
    });
  },

  async cancelCron(executionId?: string, name?: string) {
    return request<{
      success: boolean;
      cancelled: boolean;
    }>("/hooks/cron/cancel", {
      method: "POST",
      body: JSON.stringify({ executionId, name }),
    });
  },

  // CLI & Custom Commands
  async runHookCommand(name: string, args: string | string[] = []) {
    return request<{
      success: boolean;
      output: string[];
      durationMs: number;
      exitCode?: number;
      error?: string;
    }>("/hooks/commands/run", {
      method: "POST",
      body: JSON.stringify({ name, args }),
    });
  },

  async cancelHookCommand(executionId?: string, name?: string) {
    return request<{
      success: boolean;
      cancelled: boolean;
    }>("/hooks/commands/cancel", {
      method: "POST",
      body: JSON.stringify({ executionId, name }),
    });
  },

  // NPM Packages
  async listPackages() {
    return request<{
      packages: { name: string; version: string; isDev: boolean }[];
      devPackages: string[];
    }>("/hooks/packages");
  },

  async installPackage(name: string) {
    return request<{
      success: boolean;
      message: string;
      output?: string;
    }>("/hooks/packages/install", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async uninstallPackage(name: string) {
    return request<{
      success: boolean;
      message: string;
      output?: string;
    }>("/hooks/packages/uninstall", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async getHooksTree(dir = "") {
    return request<{
      items: {
        name: string;
        fullPath: string;
        isFolder: boolean;
        sizeBytes?: number;
        updatedAt?: string;
      }[];
      dir: string;
      total: number;
    }>(`/hooks/tree?dir=${encodeURIComponent(dir)}`);
  },

  async searchHookFiles(q: string) {
    return request<{
      items: {
        name: string;
        sizeBytes: number;
        updatedAt: string;
      }[];
      total: number;
    }>(`/hooks/search?q=${encodeURIComponent(q)}`);
  },

  // Static Public Files (_public)
  async listPublicFiles(lazy = false) {
    return request<{
      items: { name: string; sizeBytes: number; updatedAt: string; isFolder?: boolean }[];
      total: number;
      publicDir: string;
    }>(`/static-files${lazy ? "?lazy=true" : ""}`);
  },

  async getStaticTree(dir = "") {
    return request<{
      items: {
        name: string;
        fullPath: string;
        isFolder: boolean;
        sizeBytes?: number;
        updatedAt?: string;
      }[];
      dir: string;
      total: number;
    }>(`/static-files/tree?dir=${encodeURIComponent(dir)}`);
  },

  async searchStaticFiles(q: string) {
    return request<{
      items: {
        name: string;
        sizeBytes: number;
        updatedAt: string;
      }[];
      total: number;
    }>(`/static-files/search?q=${encodeURIComponent(q)}`);
  },

  async getPublicFile(filename: string) {
    return request<{
      name: string;
      content: string;
      sizeBytes: number;
      updatedAt: string;
    }>(`/static-files/file/${encodeURIComponent(filename)}`);
  },

  async savePublicFile(name: string, content: string) {
    return request<{ name: string; saved: boolean; path: string }>(
      "/static-files/file",
      {
        method: "POST",
        body: JSON.stringify({ name, content }),
      },
    );
  },

  async renamePublicFile(oldPath: string, newPath: string) {
    return request<{ success: boolean; oldPath: string; newPath: string }>(
      "/static-files/rename",
      {
        method: "POST",
        body: JSON.stringify({ oldPath, newPath }),
      },
    );
  },

  async copyPublicFile(sourcePath: string, targetPath: string) {
    return request<{
      success: boolean;
      sourcePath: string;
      targetPath: string;
    }>("/static-files/copy", {
      method: "POST",
      body: JSON.stringify({ sourcePath, targetPath }),
    });
  },

  async createPublicFolder(path: string) {
    return request<{ success: boolean; path: string }>("/static-files/folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  },

  async deletePublicFolder(path: string) {
    return request<{ success: boolean; message: string }>(
      `/static-files/folder?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      },
    );
  },

  async uploadPublicBatch(
    files: { path: string; content: string; isBase64?: boolean }[],
  ) {
    return request<{ success: boolean; count: number; saved: string[] }>(
      "/static-files/upload-batch",
      {
        method: "POST",
        body: JSON.stringify({ files }),
      },
    );
  },

  async deletePublicFile(filename: string) {
    return request<{ success: boolean; message: string }>(
      `/static-files/file/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      },
    );
  },

  // Logs & Stack Traces
  async listLogs(
    query: {
      page?: number;
      limit?: number;
      level?: string;
      search?: string;
      includeSuperusers?: boolean;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.level) params.set("level", query.level);
    if (query.search) params.set("search", query.search);
    if (query.includeSuperusers !== undefined) {
      params.set("includeSuperusers", String(query.includeSuperusers));
    }

    return request<PaginatedResult<LogEntry>>(`/logs?${params.toString()}`);
  },

  async getLogTimeline() {
    return request<{
      timeline: { time_bucket: string; total: number; errors: number }[];
    }>("/logs/timeline");
  },

  async getLogStats() {
    return request<{
      total: number;
      error: number;
      warn: number;
      info: number;
      avgDurationMs: number;
    }>("/logs/stats");
  },

  async clearLogs() {
    return request<{ success: boolean; message: string }>("/logs", {
      method: "DELETE",
    });
  },

  async deleteLogsBatch(data: {
    ids?: string[];
    all?: boolean;
    level?: string;
    search?: string;
    includeSuperusers?: boolean;
  }) {
    return request<{ success: boolean; count?: number; message?: string }>(
      "/logs/delete-batch",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  // Realtime Subscriptions & Web Events
  subscribe<T = any>(
    topicOrTopics: string | string[],
    callback: (event: RealtimeRecordEvent<T> | RealtimeCustomEvent<T>) => void,
  ): () => void {
    return realtimeClient.subscribe(topicOrTopics, callback);
  },

  async emitEvent(topic: string, data: any, event?: string) {
    return request<{ success: boolean; topic: string; publishedAt: string }>(
      "/events/emit",
      {
        method: "POST",
        body: JSON.stringify({ topic, data, event }),
      },
    );
  },

  // Settings & App Configuration
  async getSettings() {
    return request<AppSettings>("/settings");
  },

  async updateSettings(partialSettings: Partial<AppSettings>) {
    return request<AppSettings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(partialSettings),
    });
  },

  async getClientIpInfo() {
    return request<{
      resolvedIp: string;
      rawIp: string;
      detectedHeaders: Record<string, string>;
      detectedProxyHeader: string;
    }>("/settings/client-ip");
  },

  async sendTestEmail(toEmail: string) {
    return request<{ success: boolean; message: string }>(
      "/settings/test-email",
      {
        method: "POST",
        body: JSON.stringify({ toEmail }),
      },
    );
  },

  // Backups Engine
  async listBackups() {
    return request<{ items: BackupItem[]; total: number }>("/backups");
  },

  async createBackup(options: {
    name?: string;
    includePublic?: boolean;
    includeHooks?: boolean;
  }) {
    return request<BackupItem>("/backups", {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async restoreBackup(filename: string) {
    return request<{ success: boolean; message: string }>(
      `/backups/${encodeURIComponent(filename)}/restore`,
      {
        method: "POST",
      },
    );
  },

  async deleteBackup(filename: string) {
    return request<{ success: boolean }>(
      `/backups/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      },
    );
  },

  async uploadBackup(name: string, content: string, isBase64 = true) {
    return request<{ success: boolean; filename: string }>("/backups/upload", {
      method: "POST",
      body: JSON.stringify({ name, content, isBase64 }),
    });
  },

  async importSqlite(content: string) {
    return request<{ success: boolean; message: string }>("/backups/import-sqlite", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  realtime: {
    subscribe<T = any>(
      topicOrTopics: string | string[],
      callback: (
        event: RealtimeRecordEvent<T> | RealtimeCustomEvent<T>,
      ) => void,
    ): () => void {
      return realtimeClient.subscribe(topicOrTopics, callback);
    },
    async publish(topic: string, data: any, event?: string) {
      return request<{ success: boolean; topic: string; publishedAt: string }>(
        "/realtime/publish",
        {
          method: "POST",
          body: JSON.stringify({ topic, data, event }),
        },
      );
    },
    async getStatus() {
      return request<{ activeClientsCount: number; clients: any[] }>(
        "/realtime/status",
      );
    },
  },
};

export interface AppSettings {
  batch: {
    enabled: boolean;
    maxRequests: number;
    timeout: number;
    maxBodySize: number;
  };
  ipProxy: {
    enabled: boolean;
    headers: string[];
    priority: "rightmost" | "leftmost";
  };
  superuserIps: {
    enabled: boolean;
    allowedIps: string[];
  };
  rateLimit: {
    enabled: boolean;
    rules: {
      id: string;
      label: string;
      maxRequests: number;
      interval: number;
      target: "all" | "guests" | "auth";
    }[];
  };
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      username: string;
      password: string;
      tls: boolean;
      fromName: string;
      fromAddress: string;
    };
    templates: {
      passwordReset: { subject: string; body: string };
      verification: { subject: string; body: string };
      confirmEmailChange: { subject: string; body: string };
      otp: { subject: string; body: string };
    };
  };
  backups: {
    autoBackupEnabled: boolean;
    cronSchedule: string;
    maxRetention: number;
    includePublic: boolean;
    includeHooks: boolean;
  };
}

export interface BackupItem {
  key: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  includePublic: boolean;
  includeHooks: boolean;
}

export interface RealtimeRecordEvent<T = any> {
  action: "create" | "update" | "delete";
  collection: string;
  record: T;
  timestamp: string;
}

export interface RealtimeCustomEvent<T = any> {
  topic: string;
  data: T;
  event?: string;
  timestamp: string;
}

export type RealtimeCallback<T = any> = (
  event: RealtimeRecordEvent<T> | RealtimeCustomEvent<T> | any,
) => void;

class RealtimeClient {
  private socket: Socket | null = null;
  private clientId: string | null = null;
  private listeners = new Map<string, Set<RealtimeCallback>>();
  private onStatusCallbacks = new Set<(connected: boolean) => void>();

  public onStatus(cb: (connected: boolean) => void): () => void {
    this.onStatusCallbacks.add(cb);
    cb(this.isConnected());
    return () => this.onStatusCallbacks.delete(cb);
  }

  public get socketId(): string | null {
    return this.clientId || this.socket?.id || null;
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  private notifyStatus(connected: boolean) {
    for (const cb of this.onStatusCallbacks) {
      try {
        cb(connected);
      } catch {}
    }
  }

  private connect() {
    if (this.socket || typeof window === "undefined") return;

    const token =
      localStorage.getItem("alsabase_token") ||
      localStorage.getItem("AlsaBase_token") ||
      undefined;

    this.socket = io({
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", () => {
      this.clientId = this.socket?.id || null;
      this.notifyStatus(true);
      this.syncSubscriptions();
    });

    this.socket.on("connected", (data: any) => {
      if (data?.clientId) {
        this.clientId = data.clientId;
      }
    });

    this.socket.on("disconnect", () => {
      this.notifyStatus(false);
    });

    this.socket.on("connect_error", () => {
      this.notifyStatus(false);
    });

    // Handle incoming logs stream
    this.socket.on("logs", (data: any) => {
      const logData = data?.log || data;
      this.dispatchEvent("logs", logData);
    });

    this.socket.on("log", (data: any) => {
      const logData = data?.log || data;
      this.dispatchEvent("logs", logData);
    });

    // Handle generic record events
    this.socket.on("record", (data: any) => {
      if (data?.collection) {
        this.dispatchEvent(data.collection, data);
      }
      this.dispatchEvent("*", data);
    });

    // Catch-all listener for collection or custom events
    this.socket.onAny((eventName: string, ...args: any[]) => {
      if (
        [
          "connect",
          "disconnect",
          "connect_error",
          "connected",
          "subscriptions",
          "pong",
        ].includes(eventName)
      ) {
        return;
      }
      const data = args[0];
      this.dispatchEvent(eventName, data);
    });
  }

  private syncSubscriptions() {
    if (!this.socket || !this.socket.connected) return;
    const topics = Array.from(this.listeners.keys());
    if (topics.length > 0) {
      this.socket.emit("subscribe", topics);
    }
  }

  private dispatchEvent(topic: string, data: any) {
    try {
      const set = this.listeners.get(topic);
      if (set) {
        for (const cb of set) {
          try {
            cb(data);
          } catch (err) {
            console.error("[RealtimeClient] Error in listener:", err);
          }
        }
      }
      if (topic !== "*") {
        const wildSet = this.listeners.get("*");
        if (wildSet) {
          for (const cb of wildSet) {
            try {
              cb(data);
            } catch (err) {
              console.error(
                "[RealtimeClient] Error in wildcard listener:",
                err,
              );
            }
          }
        }
      }
    } catch {}
  }

  public subscribe<T = any>(
    topicOrTopics: string | string[],
    callback: RealtimeCallback<T>,
  ): () => void {
    const topics = Array.isArray(topicOrTopics)
      ? topicOrTopics
      : [topicOrTopics];

    for (const topic of topics) {
      if (!this.listeners.has(topic)) {
        this.listeners.set(topic, new Set());
      }
      this.listeners.get(topic)!.add(callback);
    }

    if (!this.socket) {
      this.connect();
    } else {
      this.syncSubscriptions();
    }

    return () => {
      const topicsToUnsub: string[] = [];
      for (const topic of topics) {
        const set = this.listeners.get(topic);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.listeners.delete(topic);
            topicsToUnsub.push(topic);
          }
        }
      }
      if (this.socket && this.socket.connected && topicsToUnsub.length > 0) {
        this.socket.emit("unsubscribe", topicsToUnsub);
      }
    };
  }

  public publish(topic: string, data: any, event?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("publish", { topic, data, event });
    }
  }
}

const realtimeClient = new RealtimeClient();

export const subscribeLogs = (
  callback: (log: LogEntry) => void,
): (() => void) => {
  return realtimeClient.subscribe<LogEntry>("logs", callback);
};

export const onRealtimeStatus = (
  callback: (connected: boolean) => void,
): (() => void) => {
  return realtimeClient.onStatus(callback);
};
