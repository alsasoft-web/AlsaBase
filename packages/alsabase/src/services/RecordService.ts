import { BaseService } from "./BaseService";
import type { AlsaBase } from "../Client";
import type {
  ListResult,
  RecordListOptions,
  FullListOptions,
  RecordOptions,
  CommonOptions,
  AuthResponse,
  RealtimeListener,
  UnsubscribeFunc,
  CollectionModel,
} from "../types";

export class RecordService<T = any> extends BaseService {
  readonly collectionIdOrName: string;

  constructor(client: AlsaBase, collectionIdOrName: string) {
    super(client);
    this.collectionIdOrName = collectionIdOrName;
  }

  /**
   * Base API endpoint path for the collection records
   */
  get baseCrudPath(): string {
    return `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/records`;
  }

  /**
   * Returns the current schema and column definitions of this table/collection (Requires Superuser authentication)
   */
  async getSchema(options?: CommonOptions): Promise<CollectionModel> {
    return this.client.collections.getOne(this.collectionIdOrName, options);
  }

  /**
   * Returns the schema of this table/collection (Requires Superuser authentication)
   * Alias for getSchema()
   */
  async schema(options?: CommonOptions): Promise<CollectionModel> {
    return this.getSchema(options);
  }

  /**
   * Returns the schema of this table/collection (Requires Superuser authentication)
   * Alias for getSchema()
   */
  async getTableSchema(options?: CommonOptions): Promise<CollectionModel> {
    return this.getSchema(options);
  }

  /**
   * Returns a paginated list of records
   */
  async getList(
    page: number = 1,
    perPage: number = 30,
    options?: RecordListOptions
  ): Promise<ListResult<T>> {
    const query: Record<string, any> = {
      page,
      limit: perPage,
      ...options,
    };

    return this.send<ListResult<T>>(this.baseCrudPath, {
      method: "GET",
      query,
      ...options,
    });
  }

  /**
   * Returns a list of all records in batches
   */
  async getFullList(options?: FullListOptions): Promise<T[]> {
    const batchSize = options?.batch || 200;
    let page = 1;
    let result: T[] = [];
    let hasMore = true;

    while (hasMore) {
      const list = await this.getList(page, batchSize, {
        ...options,
        skipTotal: true,
      });

      result = result.concat(list.items);

      if (list.items.length < batchSize || (list.totalPages && page >= list.totalPages)) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return result;
  }

  /**
   * Returns the first record matching the specified filter expression
   */
  async getFirstListItem(
    filter: string,
    options?: RecordOptions
  ): Promise<T> {
    const list = await this.getList(1, 1, {
      ...options,
      filter,
    });

    if (!list.items || list.items.length === 0) {
      throw new Error(`Record not found for filter: ${filter}`);
    }

    return list.items[0];
  }

  /**
   * Returns a single record by its ID
   */
  async getOne(id: string, options?: RecordOptions): Promise<T> {
    return this.send<T>(`${this.baseCrudPath}/${encodeURIComponent(id)}`, {
      method: "GET",
      ...options,
    });
  }

  /**
   * Creates a new record in the collection
   */
  async create(body: any, options?: RecordOptions): Promise<T> {
    return this.send<T>(this.baseCrudPath, {
      method: "POST",
      body,
      ...options,
    });
  }

  /**
   * Updates an existing record by its ID
   */
  async update(id: string, body: any, options?: RecordOptions): Promise<T> {
    return this.send<T>(`${this.baseCrudPath}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
      ...options,
    });
  }

  /**
   * Deletes a record by its ID
   */
  async delete(id: string, options?: CommonOptions): Promise<boolean> {
    await this.send(`${this.baseCrudPath}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      ...options,
    });
    return true;
  }

  /**
   * Truncates (deletes all records) in the collection (Requires superuser access)
   */
  async truncate(options?: CommonOptions): Promise<boolean> {
    await this.send(
      `/api/collections/${encodeURIComponent(this.collectionIdOrName)}/truncate`,
      {
        method: "DELETE",
        ...options,
      }
    );
    return true;
  }

  // --- Auth Methods ---

  /**
   * Authenticates a user with username/email and password
   */
  async authWithPassword(
    identity: string,
    password: string,
    options?: CommonOptions
  ): Promise<AuthResponse<T>> {
    const res = await this.send<any>("/api/auth/users/login", {
      method: "POST",
      body: { identity, password },
      ...options,
    });

    const authResponse: AuthResponse<T> = {
      token: res.token,
      record: (res.user || res.record) as T,
      meta: res.meta,
    };

    this.client.authStore.save(authResponse.token, authResponse.record as any);
    return authResponse;
  }

  /**
   * Authenticates a user with a one-time password (OTP)
   */
  async authWithOTP(
    otp: string,
    email: string,
    options?: CommonOptions
  ): Promise<AuthResponse<T>> {
    const res = await this.send<any>("/api/auth/verify-otp", {
      method: "POST",
      body: { otp, email },
      ...options,
    });

    const authResponse: AuthResponse<T> = {
      token: res.token,
      record: (res.user || res.record) as T,
      meta: res.meta,
    };

    this.client.authStore.save(authResponse.token, authResponse.record as any);
    return authResponse;
  }

  /**
   * Sends an OTP verification email to the user
   */
  async requestOTP(email: string, options?: CommonOptions): Promise<any> {
    return this.send("/api/auth/request-otp", {
      method: "POST",
      body: { email },
      ...options,
    });
  }

  /**
   * Refreshes the currently authenticated record token and profile
   */
  async authRefresh(options?: CommonOptions): Promise<AuthResponse<T>> {
    const user = await this.send<any>("/api/auth/users/me", {
      method: "GET",
      ...options,
    });

    const token = this.client.authStore.token;
    const authResponse: AuthResponse<T> = {
      token,
      record: user as T,
    };

    this.client.authStore.save(token, user as any);
    return authResponse;
  }

  /**
   * Sends a password reset email
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
   * Confirms a password reset request with a token and new password
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

  /**
   * Sends an email verification request
   */
  async requestVerification(
    email: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/request-verification", {
      method: "POST",
      body: { email },
      ...options,
    });
    return true;
  }

  /**
   * Confirms an email verification request
   */
  async confirmVerification(
    token: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/confirm-verification", {
      method: "POST",
      body: { token },
      ...options,
    });
    return true;
  }

  /**
   * Sends an email change verification request
   */
  async requestEmailChange(
    newEmail: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/request-email-change", {
      method: "POST",
      body: { newEmail },
      ...options,
    });
    return true;
  }

  /**
   * Confirms an email change request
   */
  async confirmEmailChange(
    token: string,
    password?: string,
    options?: CommonOptions
  ): Promise<boolean> {
    await this.send("/api/auth/confirm-email-change", {
      method: "POST",
      body: { token, password },
      ...options,
    });
    return true;
  }

  // --- Realtime Subscriptions ---

  /**
   * Subscribes to realtime events for this collection or a specific record ID
   */
  async subscribe(
    topicOrListener: string | RealtimeListener<T>,
    listener?: RealtimeListener<T>
  ): Promise<UnsubscribeFunc> {
    let topic: string;
    let cb: RealtimeListener<T>;

    if (typeof topicOrListener === "function") {
      topic = this.collectionIdOrName;
      cb = topicOrListener;
    } else {
      topic = `${this.collectionIdOrName}/${topicOrListener}`;
      cb = listener!;
    }

    return this.client.realtime.subscribe(topic, cb);
  }

  /**
   * Unsubscribes from realtime events for this collection or a specific record ID
   */
  async unsubscribe(topic?: string): Promise<void> {
    const fullTopic = topic
      ? `${this.collectionIdOrName}/${topic}`
      : this.collectionIdOrName;
    return this.client.realtime.unsubscribe(fullTopic);
  }
}
