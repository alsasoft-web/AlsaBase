import { BaseService } from "./BaseService";
import type {
  FileDetailResponse,
  TreeResponse,
  BatchUploadFileItem,
  BatchUploadResponse,
  CommonOptions,
} from "../types";

export class FileService extends BaseService {
  /**
   * Generates a URL for accessing an uploaded record file asset
   *
   * @param record Record object or record ID string
   * @param filename Filename of the uploaded asset
   * @param queryParams Optional query parameters (e.g. thumb, download)
   */
  getUrl(
    record:
      | { id?: string; collectionName?: string; collectionId?: string }
      | string,
    filename: string,
    queryParams?: Record<string, any>,
  ): string {
    if (!filename) return "";

    let fileUrlPath: string;

    if (typeof record === "object" && record !== null) {
      const col = record.collectionName || record.collectionId || "";
      const id = record.id || "";
      if (col && id) {
        fileUrlPath = `/api/static-files/file/${encodeURIComponent(col)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`;
      } else if (id) {
        fileUrlPath = `/api/static-files/file/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`;
      } else {
        fileUrlPath = `/api/static-files/file/${encodeURIComponent(filename)}`;
      }
    } else if (typeof record === "string" && record) {
      fileUrlPath = `/api/static-files/file/${encodeURIComponent(record)}/${encodeURIComponent(filename)}`;
    } else {
      fileUrlPath = `/api/static-files/file/${encodeURIComponent(filename)}`;
    }

    return this.client.buildUrl(fileUrlPath, queryParams);
  }

  /**
   * Generates a URL for a public website static asset hosted in _public
   *
   * @param relPath Relative path inside _public (e.g. 'images/banner.png')
   */
  getPublicUrl(relPath: string): string {
    const clean = relPath.replace(/^[\/\\]+/, "");
    return `${this.client.baseUrl.replace(/\/+$/, "")}/${clean}`;
  }

  /**
   * Lists all files in the _public directory
   */
  async listPublicFiles(
    options?: CommonOptions,
  ): Promise<{ items: any[]; total: number; publicDir: string }> {
    return this.send("/api/static-files", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Gets a folder tree for the _public directory
   */
  async getPublicTree(
    dir = "",
    options?: CommonOptions,
  ): Promise<TreeResponse> {
    return this.send<TreeResponse>(
      `/api/static-files/tree?dir=${encodeURIComponent(dir)}`,
      {
        method: "GET",
        ...options,
      },
    );
  }

  /**
   * Reads a file's content from the _public directory
   */
  async readPublicFile(
    path: string,
    options?: CommonOptions,
  ): Promise<FileDetailResponse> {
    return this.send<FileDetailResponse>(
      `/api/static-files/file?path=${encodeURIComponent(path)}`,
      {
        method: "GET",
        ...options,
      },
    );
  }

  /**
   * Saves or updates a file in the _public directory (Superuser required)
   */
  async savePublicFile(
    name: string,
    content: string,
    isBase64 = false,
    options?: CommonOptions,
  ): Promise<{ name: string; saved: boolean; path: string }> {
    return this.send("/api/static-files/file", {
      method: "POST",
      body: { name, content, isBase64 },
      ...options,
    });
  }

  /**
   * Uploads a batch of files to the _public directory (Superuser required)
   */
  async uploadPublicBatch(
    files: BatchUploadFileItem[],
    options?: CommonOptions,
  ): Promise<BatchUploadResponse> {
    return this.send<BatchUploadResponse>("/api/static-files/upload-batch", {
      method: "POST",
      body: { files },
      ...options,
    });
  }

  /**
   * Deletes a file in the _public directory (Superuser required)
   */
  async deletePublicFile(
    path: string,
    options?: CommonOptions,
  ): Promise<{ success: boolean; message: string }> {
    return this.send(
      `/api/static-files/file?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        ...options,
      },
    );
  }

  /**
   * Creates a folder inside the _public directory (Superuser required)
   */
  async createPublicFolder(
    path: string,
    options?: CommonOptions,
  ): Promise<{ success: boolean; path: string }> {
    return this.send("/api/static-files/folder", {
      method: "POST",
      body: { path },
      ...options,
    });
  }

  /**
   * Deletes a folder and all its contents inside the _public directory (Superuser required)
   */
  async deletePublicFolder(
    path: string,
    options?: CommonOptions,
  ): Promise<{ success: boolean; message: string }> {
    return this.send(
      `/api/static-files/folder?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        ...options,
      },
    );
  }
}
