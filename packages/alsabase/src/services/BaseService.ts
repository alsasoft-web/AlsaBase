import type { AlsaBase } from "../Client";
import type { SendOptions } from "../types";

export abstract class BaseService {
  readonly client: AlsaBase;

  constructor(client: AlsaBase) {
    this.client = client;
  }

  protected async send<T = any>(path: string, options?: SendOptions): Promise<T> {
    return this.client.send<T>(path, options);
  }
}
