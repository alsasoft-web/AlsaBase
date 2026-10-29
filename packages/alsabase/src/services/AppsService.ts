import { BaseService } from "./BaseService";
import type {
  AppModel,
  AppVersionModel,
  AppUpdateCheckOptions,
  AppUpdateCheckResult,
  AppVersionUploadOptions,
  AppLicenseModel,
  AppDeviceModel,
  AppLicenseValidateResult,
  AppLicenseActivateResult,
  AppDeviceCheckResult,
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
    if (options.deviceId) query.deviceId = options.deviceId;

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
   * Check whether a client PC / hardware device is permitted or locked from accessing the app.
   *
   * @param appSlug Unique slug identifier of the app
   * @param deviceId Unique hardware ID / MAC / machine identifier
   * @param options Common request options
   */
  async checkDevice(
    appSlug: string,
    deviceId: string,
    options?: CommonOptions
  ): Promise<AppDeviceCheckResult> {
    return this.send<AppDeviceCheckResult>(
      `/api/apps/${encodeURIComponent(appSlug)}/devices/check`,
      {
        method: "GET",
        query: { deviceId },
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Validate a license key or check existing activation for a device.
   *
   * @param appSlug Unique slug identifier of the app
   * @param payload Hardware device ID and optional serial key to validate
   * @param options Common request options
   */
  async validateLicense(
    appSlug: string,
    payload: { key?: string; deviceId: string },
    options?: CommonOptions
  ): Promise<AppLicenseValidateResult> {
    return this.send<AppLicenseValidateResult>(
      `/api/apps/${encodeURIComponent(appSlug)}/licenses/validate`,
      {
        method: "POST",
        body: payload,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Activate a serial key on a hardware device / PC.
   *
   * @param appSlug Unique slug identifier of the app
   * @param payload License key, device ID, and optional device metadata
   * @param options Common request options
   */
  async activateLicense(
    appSlug: string,
    payload: {
      key: string;
      deviceId: string;
      deviceName?: string;
      osName?: string;
      platform?: string;
    },
    options?: CommonOptions
  ): Promise<AppLicenseActivateResult> {
    return this.send<AppLicenseActivateResult>(
      `/api/apps/${encodeURIComponent(appSlug)}/licenses/activate`,
      {
        method: "POST",
        body: payload,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Deactivate a serial key from a device / PC, releasing an activation slot.
   *
   * @param appSlug Unique slug identifier of the app
   * @param payload License key and device ID to unlink
   * @param options Common request options
   */
  async deactivateLicense(
    appSlug: string,
    payload: { key: string; deviceId: string },
    options?: CommonOptions
  ): Promise<{ success: boolean; message: string; license?: AppLicenseModel }> {
    return this.send<{ success: boolean; message: string; license?: AppLicenseModel }>(
      `/api/apps/${encodeURIComponent(appSlug)}/licenses/deactivate`,
      {
        method: "POST",
        body: payload,
        headers: options?.headers,
        requestKey: options?.requestKey,
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
      maxDevices?: number | null;
      devicePolicy?: "unrestricted" | "max_devices" | "whitelist_only";
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
      maxDevices?: number | null;
      devicePolicy?: "unrestricted" | "max_devices" | "whitelist_only";
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

  // ============================================================================
  // Superuser License & Device Management Methods
  // ============================================================================

  /**
   * List licenses for an application (Requires Superuser).
   */
  async manageListLicenses(
    appIdOrSlug: string,
    query?: { search?: string; status?: string },
    options?: CommonOptions
  ): Promise<AppLicenseModel[]> {
    const res = await this.send<{ items: AppLicenseModel[] }>("/api/apps/manage/licenses", {
      method: "GET",
      query: { appId: appIdOrSlug, ...query },
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
    return res.items || [];
  }

  /**
   * Create or batch-generate license serial keys (Requires Superuser).
   */
  async manageCreateLicenses(
    payload: {
      appId?: string;
      appSlug?: string;
      count?: number;
      serialKey?: string;
      format?: string;
      maxActivations?: number;
      expiresAt?: string;
      customerName?: string;
      customerEmail?: string;
      notes?: string;
      metadata?: any;
    },
    options?: CommonOptions
  ): Promise<{ success: boolean; createdCount: number; licenses: AppLicenseModel[] }> {
    return this.send<{ success: boolean; createdCount: number; licenses: AppLicenseModel[] }>(
      "/api/apps/manage/licenses",
      {
        method: "POST",
        body: payload,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Update license status, customer info, or activation limit (Requires Superuser).
   */
  async manageUpdateLicense(
    id: string,
    payload: Partial<AppLicenseModel>,
    options?: CommonOptions
  ): Promise<AppLicenseModel> {
    return this.send<AppLicenseModel>(
      `/api/apps/manage/licenses/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: payload,
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Delete a license key and all its associated activations (Requires Superuser).
   */
  async manageDeleteLicense(id: string, options?: CommonOptions): Promise<boolean> {
    const res = await this.send<{ success: boolean }>(
      `/api/apps/manage/licenses/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
    return !!res.success;
  }

  /**
   * List client devices / PCs registered for an application (Requires Superuser).
   */
  async manageListDevices(
    appIdOrSlug: string,
    query?: { search?: string; isLocked?: boolean },
    options?: CommonOptions
  ): Promise<AppDeviceModel[]> {
    const res = await this.send<{ items: AppDeviceModel[] }>("/api/apps/manage/devices", {
      method: "GET",
      query: { appId: appIdOrSlug, ...query },
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
    return res.items || [];
  }

  /**
   * Pre-register or lock a client PC / hardware ID with a reason (Requires Superuser).
   */
  async manageLockDevice(
    payload: {
      appId?: string;
      appSlug?: string;
      deviceId: string;
      deviceName?: string;
      isLocked?: boolean;
      reason?: string;
    },
    options?: CommonOptions
  ): Promise<AppDeviceModel> {
    return this.send<AppDeviceModel>("/api/apps/manage/devices/lock", {
      method: "POST",
      body: payload,
      headers: options?.headers,
      requestKey: options?.requestKey,
    });
  }

  /**
   * Toggle lock status on an existing registered device (Requires Superuser).
   */
  async manageToggleDeviceLock(
    id: string,
    isLocked: boolean,
    reason?: string,
    options?: CommonOptions
  ): Promise<AppDeviceModel> {
    return this.send<AppDeviceModel>(
      `/api/apps/manage/devices/${encodeURIComponent(id)}/lock`,
      {
        method: "PUT",
        body: { isLocked, reason },
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
  }

  /**
   * Delete / Unbind a device record (Requires Superuser).
   */
  async manageDeleteDevice(id: string, options?: CommonOptions): Promise<boolean> {
    const res = await this.send<{ success: boolean }>(
      `/api/apps/manage/devices/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: options?.headers,
        requestKey: options?.requestKey,
      }
    );
    return !!res.success;
  }
}

