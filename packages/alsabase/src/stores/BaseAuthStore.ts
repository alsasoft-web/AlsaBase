import { RecordModel, SuperuserModel } from "../types";

export type AuthModelType = RecordModel | SuperuserModel | null;

export type OnStoreChangeFunc = (token: string, model: AuthModelType) => void;

export class BaseAuthStore {
  protected _token: string = "";
  protected _model: AuthModelType = null;
  private _listeners: Set<OnStoreChangeFunc> = new Set();

  get token(): string {
    return this._token;
  }

  get model(): AuthModelType {
    return this._model;
  }

  get isValid(): boolean {
    if (!this.token) return false;
    const jwt = this.parseJwt(this.token);
    if (!jwt || !jwt.exp) return true; // without exp header, treat as valid if present
    const now = Math.floor(Date.now() / 1000);
    return jwt.exp > now;
  }

  get isSuperuser(): boolean {
    if (!this.model) return false;
    return !!(this.model as any).email && (this.model as any).collectionName === undefined;
  }

  get isAdmin(): boolean {
    return this.isSuperuser;
  }

  save(token: string, model: AuthModelType) {
    this._token = token || "";
    this._model = model || null;
    this.triggerChange();
  }

  clear() {
    this._token = "";
    this._model = null;
    this.triggerChange();
  }

  onChange(callback: OnStoreChangeFunc): () => void {
    this._listeners.add(callback);
    return () => {
      this._listeners.delete(callback);
    };
  }

  protected triggerChange() {
    for (const listener of this._listeners) {
      try {
        listener(this._token, this._model);
      } catch (err) {
        console.error("AuthStore change listener error:", err);
      }
    }
  }

  parseJwt(token: string): any {
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      let jsonPayload: string;

      if (typeof atob === "function") {
        jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
      } else if (typeof (globalThis as any).Buffer !== "undefined") {
        jsonPayload = (globalThis as any).Buffer.from(base64, "base64").toString("utf8");
      } else {
        return null;
      }
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }
}
