import { BaseService } from "./BaseService";
import type {
  AppModel,
  AppVersionModel,
  AppUpdateCheckOptions,
  AppUpdateCheckResult,
  AppVersionUploadOptions,
  CommonOptions,
} from "../types";

export class AppsService extends BaseService {
  /**
   * Check if an update is available for an app.
   * Compares the app's current version against published versions and verifies
   * user access rules (e.g. beta/alpha testers targeting based on table column values).
   *
   * @param appSlug Unique slug identifier of the app (e.g. 'desktop-app', 'mobile-client')
   * @param options Update check options (currentVersion, platform, channel)
   */
  async checkUpdate(
    appSlug: string,
    options: AppUpdateCheckOptions
  ): Promise<AppUpdateCheckResult> {
    const query: Record<string, any> = {
      currentVersion: options.currentVersion,
    };
    if (options.platform) query.platform = options.platform;
    if (options.channel) query.channel = options.channel;

    return this.send<AppUpdateCheckResult>(
      `/api/apps/${encodeURIComponent(appSlug)}/check-update`,
      {
        method: "GET",
        query,
        headers: options.headers,
        requestKey: options.requestKey,
      }
    );
  }

  /**
   * List all eligible versions published for an app.
   *
   * @param appSlug Unique slug of the app
   * @param options Optional platform filter and common request options
   */
  async getVersions(
    appSlug: string,
    options?: CommonOptions & { platform?: string }
  ): Promise<AppVersionModel[]> {
    const query: Record<string, any> = {};
    if (options?.platform) query.platform = options.platform;

    const res = await this.send<{ items: AppVersionModel[] }>(
      `/api/apps/${encodeURIComponent(appSlug)}/versions`,
      {
        method: "GET",
        query,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
    return res.items || [];
  }

  /**
   * Get metadata for a specific app version.
   */
  async getVersion(
    appSlug: string,
    version: string,
    options?: CommonOptions
  ): Promise<AppVersionModel> {
    return this.send<AppVersionModel>(
      `/api/apps/${encodeURIComponent(appSlug)}/versions/${encodeURIComponent(version)}`,
      {
        method: "GET",
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Returns the direct download URL for a specific app release binary.
   */
  getDownloadUrl(appSlug: string, version: string): string {
    return `${this.client.baseUrl}/api/apps/${encodeURIComponent(appSlug)}/versions/${encodeURIComponent(version)}/download`;
  }

  /**
   * List active applications available on this AlsaBase instance.
   */
  async listApps(options?: CommonOptions): Promise<AppModel[]> {
    const res = await this.send<{ items: AppModel[] }>("/api/apps", {
      method: "GET",
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
    return res.items || [];
  }

  /**
   * Get information for a specific application.
   */
  async getApp(appSlug: string, options?: CommonOptions): Promise<AppModel> {
    return this.send<AppModel>(`/api/apps/${encodeURIComponent(appSlug)}`, {
      method: "GET",
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
  }

  // ============================================================================
  // Superuser Management Methods (Requires Superuser Authentication)
  // ============================================================================

  /**
   * List all apps with detailed stats (Requires Superuser).
   */
  async manageListApps(options?: CommonOptions): Promise<AppModel[]> {
    const res = await this.send<{ items: AppModel[] }>("/api/apps/manage/apps", {
      method: "GET",
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
    return res.items || [];
  }

  /**
   * Create a new app (Requires Superuser).
   */
  async createApp(
    data: {
      name: string;
      slug?: string;
      description?: string;
      iconUrl?: string;
      iconFile?: { name: string; data: string; size?: number; type?: string } | string;
    },
    options?: CommonOptions
  ): Promise<AppModel> {
    return this.send<AppModel>("/api/apps/manage/apps", {
      method: "POST",
      body: data,
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
  }

  /**
   * Update an existing app (Requires Superuser).
   */
  async updateApp(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      iconUrl?: string;
      iconFile?: { name: string; data: string; size?: number; type?: string } | string;
    },
    options?: CommonOptions
  ): Promise<AppModel> {
    return this.send<AppModel>(`/api/apps/manage/apps/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: data,
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
  }

  /**
   * Delete an app, all its versions, and physical files (Requires Superuser).
   */
  async deleteApp(id: string, options?: CommonOptions): Promise<boolean> {
    const res = await this.send<{ success: boolean }>(
      `/api/apps/manage/apps/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
    return !!res.success;
  }

  /**
   * List all versions across all apps or for a specific app (Requires Superuser).
   */
  async manageListVersions(
    query?: { appId?: string; appSlug?: string },
    options?: CommonOptions
  ): Promise<AppVersionModel[]> {
    const res = await this.send<{ items: AppVersionModel[] }>("/api/apps/manage/versions", {
      method: "GET",
      query,
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
    return res.items || [];
  }

  /**
   * Upload / Publish a new app version using superuser credentials (Requires Superuser).
   *
   * @param data Version payload including file binary (base64) and release configuration
   */
  async uploadVersion(
    data: AppVersionUploadOptions,
    options?: CommonOptions
  ): Promise<AppVersionModel> {
    const { headers, requestKey, ...bodyData } = data;
    return this.send<AppVersionModel>("/api/apps/manage/versions", {
      method: "POST",
      body: bodyData,
      headers: headers || options?.headers,
      requestKey: requestKey || options?.requestKey,
    });
  }

  /**
   * Update an existing app version's metadata (Requires Superuser).
   */
  async updateVersion(
    id: string,
    data: Partial<AppVersionUploadOptions>,
    options?: CommonOptions
  ): Promise<AppVersionModel> {
    return this.send<AppVersionModel>(
      `/api/apps/manage/versions/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: data,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Delete an app version and remove its binary from storage (Requires Superuser).
   */
  async deleteVersion(id: string, options?: CommonOptions): Promise<boolean> {
    const res = await this.send<{ success: boolean }>(
      `/api/apps/manage/versions/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
    return !!res.success;
  }
}

