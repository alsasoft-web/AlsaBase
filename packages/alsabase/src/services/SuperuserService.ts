import { BaseService } from "./BaseService";
import type {
  SuperuserAuthResponse,
  SuperuserModel,
  CommonOptions,
} from "../types";

export class SuperuserService extends BaseService {
  /**
   * Authenticates a superuser with email and password
   */
  async authWithPassword(
    email: string,
    password: string,
    options?: CommonOptions
  ): Promise<SuperuserAuthResponse> {
    const res = await this.send<SuperuserAuthResponse>(
      "/api/auth/superusers/login",
      {
        method: "POST",
        body: { email, password },
        ...options,
      }
    );

    this.client.authStore.save(res.token, res.user);
    return res;
  }

  /**
   * Checks if an initial superuser exists in the system
   */
  async hasInitialSuperuser(
    options?: CommonOptions
  ): Promise<{ hasSuperuser: boolean }> {
    return this.send<{ hasSuperuser: boolean }>(
      "/api/auth/superusers/has-initial",
      {
        method: "GET",
        ...options,
      }
    );
  }

  /**
   * Sets up the first superuser account (Only available when no superusers exist)
   */
  async setupInitialSuperuser(
    email: string,
    password: string,
    options?: CommonOptions
  ): Promise<SuperuserAuthResponse> {
    const res = await this.send<SuperuserAuthResponse>(
      "/api/auth/superusers/setup",
      {
        method: "POST",
        body: { email, password },
        ...options,
      }
    );

    this.client.authStore.save(res.token, res.user);
    return res;
  }

  /**
   * Returns current authenticated superuser profile
   */
  async getMe(options?: CommonOptions): Promise<SuperuserModel> {
    return this.send<SuperuserModel>("/api/auth/superusers/me", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Refreshes superuser auth state
   */
  async authRefresh(
    options?: CommonOptions
  ): Promise<SuperuserAuthResponse> {
    const user = await this.getMe(options);
    const token = this.client.authStore.token;
    const res: SuperuserAuthResponse = {
      token,
      user,
    };
    this.client.authStore.save(token, user);
    return res;
  }

  /**
   * Requests a password reset email for superuser
   */
  async requestPasswordReset(
    email: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/request-password-reset", {
      method: "POST",
      body: { email },
      ...options,
    });
    return true;
  }

  /**
   * Confirms a password reset with token
   */
  async confirmPasswordReset(
    token: string,
    password: string,
    _passwordConfirm?: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/confirm-password-reset", {
      method: "POST",
      body: { token, password },
      ...options,
    });
    return true;
  }
}

export type AdminService = SuperuserService;
