export interface BaseModel {
  id: string;
  created?: string;
  updated?: string;
  [key: string]: any;
}

export interface RecordModel extends BaseModel {
  id: string;
  collectionId?: string;
  collectionName?: string;
  created?: string;
  updated?: string;
}

export interface AuthModel extends RecordModel {
  email?: string;
  username?: string;
  verified?: boolean;
  emailVisibility?: boolean;
}

export interface SuperuserModel extends BaseModel {
  id: string;
  email: string;
  role?: string;
  created?: string;
  updated?: string;
}

export type AdminModel = SuperuserModel;

export interface AuthResponse<T = RecordModel> {
  token: string;
  record: T;
  meta?: any;
}

export interface SuperuserAuthResponse {
  token: string;
  user: SuperuserModel;
}

export type AdminAuthResponse = SuperuserAuthResponse;

export interface ListResult<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export interface SendOptions extends RequestInit {
  query?: Record<string, any>;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  requestKey?: string | null;
  autoCancel?: boolean;
}

export interface CommonOptions {
  fields?: string;
  expand?: string;
  filter?: string;
  sort?: string;
  requestKey?: string | null;
  [key: string]: any;
}

export interface ListOptions extends CommonOptions {
  page?: number;
  perPage?: number;
  skipTotal?: boolean;
}

export interface RecordOptions extends CommonOptions {}

export interface RecordListOptions extends ListOptions {}

export interface FullListOptions extends CommonOptions {
  batch?: number;
}

export interface FieldDef {
  name: string;
  type: "text" | "number" | "bool" | "email" | "url" | "date" | "autodate" | "select" | "json" | "file" | "relation";
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
  options?: Record<string, any>;
}

export interface TableIndexInfo {
  name: string;
  tableName: string;
  unique: boolean;
  columns: string[];
  sql?: string;
  primaryKey?: boolean;
}

export interface CollectionRule {
  list?: string | null;
  view?: string | null;
  create?: string | null;
  update?: string | null;
  delete?: string | null;
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  authWithPassword?: string;
  authRule?: string;
  manageRule?: string;
}

export interface CollectionModel {
  id: string;
  name: string;
  type: "base" | "auth" | "view";
  fields?: FieldDef[];
  schema?: FieldDef[];
  rules?: CollectionRule;
  indexes?: string[];
  options?: Record<string, any>;
  created?: string;
  updated?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LogModel {
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

export interface LogListOptions {
  page?: number;
  perPage?: number;
  level?: string;
  search?: string;
  includeSuperusers?: boolean;
  requestKey?: string | null;
}

export interface LogTimelineItem {
  time_bucket: string;
  total: number;
  errors: number;
}

export interface LogStats {
  total: number;
  error: number;
  warn: number;
  info: number;
  avgDurationMs: number;
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

export type RealtimeListener<T = any> = (
  event: RealtimeRecordEvent<T> | RealtimeCustomEvent<T> | any
) => void;

export type UnsubscribeFunc = () => void;

export interface HookRouteDef {
  method: string;
  path: string;
  authLevel: string;
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

export interface HookCommandDef {
  name: string;
  description?: string;
  usage?: string;
  sourceFile?: string;
  type?: string;
}

export interface HookFileItem {
  name: string;
  filename?: string;
  sizeBytes: number;
  updatedAt: string;
  error?: string | null;
  isFolder?: boolean;
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

export interface FileDetailResponse {
  name: string;
  content: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface TreeNodeItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface TreeResponse {
  items: TreeNodeItem[];
  dir: string;
  total: number;
}

export interface BatchUploadFileItem {
  path: string;
  content: string;
  isBase64?: boolean;
}

export interface BatchUploadResponse {
  success: boolean;
  count: number;
  saved: string[];
}

export interface SystemStats {
  timestamp: string;
  process: {
    uptimeSeconds: number;
    pid: number;
    nodeVersion: string;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers: number;
      percentOfHost: number;
    };
  };
  host: {
    platform: string;
    type: string;
    release: string;
    arch: string;
    hostname: string;
    uptimeSeconds: number;
    memory: {
      totalBytes: number;
      freeBytes: number;
      usedBytes: number;
      usedPercent: number;
    };
    cpu: {
      cores: number;
      model: string;
      speedMHz: number;
      loadAvg: {
        oneMin: number;
        fiveMin: number;
        fifteenMin: number;
      };
    };
    disk: {
      totalBytes: number;
      freeBytes: number;
      usedBytes: number;
      usedPercent: number;
      available: boolean;
    };
  };
  storage: {
    databaseBytes: number;
    uploadsBytes: number;
    backupsBytes: number;
    publicBytes: number;
    hooksBytes: number;
    totalDataBytes: number;
  };
  database: {
    totalCollections: number;
    totalRecords: number;
    walMode: boolean;
  };
}

