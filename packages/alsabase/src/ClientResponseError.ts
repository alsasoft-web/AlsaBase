export class ClientResponseError extends Error {
  url: string = "";
  status: number = 0;
  response: { [key: string]: any } = {};
  data: { [key: string]: any } = {};
  isAbort: boolean = false;
  originalError: any = null;

  constructor(errData?: any) {
    super("ClientResponseError");

    if (errData !== null && typeof errData === "object") {
      this.url = errData.url || "";
      this.status = errData.status || 0;
      this.data = errData.data || {};
      this.response = errData.response || this.data;
      this.isAbort = !!errData.isAbort;
      this.originalError = errData.originalError || null;

      if (errData.message) {
        this.message = errData.message;
      } else if (this.data?.message) {
        this.message = this.data.message;
      } else if (this.data?.error) {
        this.message = this.data.error;
      } else if (this.status) {
        this.message = `Response error. Status code: ${this.status}`;
      }
    }

    if (typeof DOMException !== "undefined" && errData instanceof DOMException && errData.name === "AbortError") {
      this.isAbort = true;
      this.message = "The request was autocancelled or aborted.";
    }

    Object.setPrototypeOf(this, ClientResponseError.prototype);
  }

  toJSON() {
    return {
      url: this.url,
      status: this.status,
      data: this.data,
      response: this.response,
      isAbort: this.isAbort,
      message: this.message,
    };
  }
}
