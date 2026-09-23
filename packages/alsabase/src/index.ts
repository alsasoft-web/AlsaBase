import { AlsaBase } from "./Client";

export { AlsaBase, AlsaBase as Client } from "./Client";
export { ClientResponseError } from "./ClientResponseError";

// Auth Stores
export { BaseAuthStore } from "./stores/BaseAuthStore";
export { LocalAuthStore } from "./stores/LocalAuthStore";
export { AsyncAuthStore } from "./stores/AsyncAuthStore";

// Services
export { BaseService } from "./services/BaseService";
export { RecordService } from "./services/RecordService";
export { CollectionService } from "./services/CollectionService";
export { SuperuserService, type AdminService } from "./services/SuperuserService";
export { LogService } from "./services/LogService";
export { RealtimeService } from "./services/RealtimeService";
export { FileService } from "./services/FileService";
export { HooksService } from "./services/HooksService";

// Types
export * from "./types";

export default AlsaBase;
