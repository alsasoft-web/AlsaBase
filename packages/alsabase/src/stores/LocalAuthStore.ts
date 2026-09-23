import { BaseAuthStore, AuthModelType } from "./BaseAuthStore";

const DEFAULT_STORAGE_KEY = "alsabase_auth";

export class LocalAuthStore extends BaseAuthStore {
  storageKey: string;

  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    super();
    this.storageKey = storageKey;
    this.loadInitial();
  }

  private loadInitial() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        this._token = parsed.token || "";
        this._model = parsed.model || null;
      }
    } catch {}
  }

  override save(token: string, model: AuthModelType) {
    super.save(token, model);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(
          this.storageKey,
          JSON.stringify({ token: this._token, model: this._model })
        );
      } catch {}
    }
  }

  override clear() {
    super.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(this.storageKey);
      } catch {}
    }
  }
}
