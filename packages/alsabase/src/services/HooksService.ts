import { BaseService } from "./BaseService";
import type {
  HooksOverview,
  FileDetailResponse,
  TreeResponse,
  BatchUploadFileItem,
  BatchUploadResponse,
  CommonOptions,
} from "../types";

export class HooksService extends BaseService {
  /**
   * Returns an overview of all active hooks, routes, crons, and commands (Superuser required)
   */
  async getOverview(options?: CommonOptions): Promise<HooksOverview> {
    return this.send<HooksOverview>("/api/hooks", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Lists all files in the _hooks directory (Superuser required)
   */
  async listFiles(options?: CommonOptions): Promise<{ items: any[]; total: number }> {
    return this.send("/api/hooks/files", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Gets a folder tree for the _hooks directory (Superuser required)
   */
  async getTree(dir = "", options?: CommonOptions): Promise<TreeResponse> {
    return this.send<TreeResponse>(`/api/hooks/tree?dir=${encodeURIComponent(dir)}`, {
      method: "GET",
      ...options,
    });
  }

  /**
   * Reads a file's content from the _hooks directory (Superuser required)
   */
  async readFile(path: string, options?: CommonOptions): Promise<FileDetailResponse> {
    return this.send<FileDetailResponse>(`/api/hooks/files/file?path=${encodeURIComponent(path)}`, {
      method: "GET",
      ...options,
    });
  }

  /**
   * Saves or updates a file in the _hooks directory (Superuser required)
   */
  async saveFile(
    name: string,
    content: string,
    isBase64 = false,
    options?: CommonOptions
  ): Promise<{ name: string; saved: boolean; path: string }> {
    return this.send("/api/hooks/files", {
      method: "POST",
      body: { name, content, isBase64 },
      ...options,
    });
  }

  /**
   * Uploads a batch of files to the _hooks directory (Superuser required)
   */
  async uploadBatch(
    files: BatchUploadFileItem[],
    options?: CommonOptions
  ): Promise<BatchUploadResponse> {
    return this.send<BatchUploadResponse>("/api/hooks/files/upload-batch", {
      method: "POST",
      body: { files },
      ...options,
    });
  }

  /**
   * Deletes a file in the _hooks directory (Superuser required)
   */
  async deleteFile(path: string, options?: CommonOptions): Promise<{ success: boolean; message: string }> {
    return this.send(`/api/hooks/files/file?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      ...options,
    });
  }

  /**
   * Creates a folder inside the _hooks directory (Superuser required)
   */
  async createFolder(path: string, options?: CommonOptions): Promise<{ success: boolean; path: string }> {
    return this.send("/api/hooks/files/folder", {
      method: "POST",
      body: { path },
      ...options,
    });
  }

  /**
   * Deletes a folder and all its contents inside the _hooks directory (Superuser required)
   */
  async deleteFolder(path: string, options?: CommonOptions): Promise<{ success: boolean; message: string }> {
    return this.send(`/api/hooks/files/folder?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      ...options,
    });
  }

  /**
   * Manually triggers execution of a scheduled cron job (Superuser required)
   */
  async triggerCron(name: string, options?: CommonOptions): Promise<any> {
    return this.send(`/api/hooks/cron/${encodeURIComponent(name)}/trigger`, {
      method: "POST",
      ...options,
    });
  }

  /**
   * Cancels a running cron job (Superuser required)
   */
  async cancelCron(executionId?: string, name?: string, options?: CommonOptions): Promise<any> {
    return this.send("/api/hooks/cron/cancel", {
      method: "POST",
      body: { executionId, name },
      ...options,
    });
  }

  /**
   * Runs a custom hook CLI command (Superuser required)
   */
  async runCommand(
    name: string,
    args?: any,
    options?: CommonOptions
  ): Promise<any> {
    return this.send(`/api/hooks/commands/${encodeURIComponent(name)}/run`, {
      method: "POST",
      body: { args },
      ...options,
    });
  }

  /**
   * Cancels a running CLI command (Superuser required)
   */
  async cancelCommand(executionId?: string, name?: string, options?: CommonOptions): Promise<any> {
    return this.send("/api/hooks/commands/cancel", {
      method: "POST",
      body: { executionId, name },
      ...options,
    });
  }

  /**
   * Reloads all hook files and re-registers custom routes (Superuser required)
   */
  async reload(options?: CommonOptions): Promise<any> {
    return this.send("/api/hooks/reload", {
      method: "POST",
      ...options,
    });
  }
}
