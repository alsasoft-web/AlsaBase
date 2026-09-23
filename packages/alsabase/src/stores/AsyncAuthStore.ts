import { BaseAuthStore, AuthModelType } from "./BaseAuthStore";

export interface AsyncAuthStoreOptions {
  save?: (serialized: string) => Promise<void>;
  clear?: () => Promise<void>;
  initial?: string;
}

export class AsyncAuthStore extends BaseAuthStore {
  private _saveHandler?: (serialized: string) => Promise<void>;
  private _clearHandler?: () => Promise<void>;

  constructor(options: AsyncAuthStoreOptions = {}) {
    super();
    this._saveHandler = options.save;
    this._clearHandler = options.clear;

    if (options.initial) {
      try {
        const parsed = JSON.parse(options.initial);
        if (parsed && typeof parsed === "object") {
          this._token = parsed.token || "";
          this._model = parsed.model || null;
        }
      } catch {}
    }
  }

  override save(token: string, model: AuthModelType) {
    super.save(token, model);
    if (this._saveHandler) {
      this._saveHandler(JSON.stringify({ token: this._token, model: this._model })).catch(
        (err) => console.error("AsyncAuthStore save failed:", err)
      );
    }
  }

  override clear() {
    super.clear();
    if (this._clearHandler) {
      this._clearHandler().catch((err) =>
        console.error("AsyncAuthStore clear failed:", err)
      );
    }
  }
}
