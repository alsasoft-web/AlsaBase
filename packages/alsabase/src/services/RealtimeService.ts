import { io, Socket } from "socket.io-client";
import { BaseService } from "./BaseService";
import type { RealtimeListener, UnsubscribeFunc } from "../types";

export class RealtimeService extends BaseService {
  private subscriptions: Map<string, Set<RealtimeListener>> = new Map();
  private socket: Socket | null = null;
  private isConnecting = false;

  /**
   * Checks if realtime is currently connected
   */
  get isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  /**
   * Subscribes a listener callback to a specific topic or collection
   */
  async subscribe<T = any>(
    topic: string,
    listener: RealtimeListener<T>
  ): Promise<UnsubscribeFunc> {
    const trimmedTopic = (topic || "*").trim();
    if (!this.subscriptions.has(trimmedTopic)) {
      this.subscriptions.set(trimmedTopic, new Set());
    }

    this.subscriptions.get(trimmedTopic)!.add(listener as RealtimeListener);
    this.ensureConnection();

    // If socket is already connected, emit subscribe immediately
    if (this.socket && this.socket.connected) {
      this.socket.emit("subscribe", trimmedTopic);
    }

    return () => {
      this.unsubscribeFromTopic(trimmedTopic, listener as RealtimeListener);
    };
  }

  /**
   * Unsubscribes all listeners or a specific listener from a topic
   */
  async unsubscribe(topic?: string): Promise<void> {
    if (!topic) {
      if (this.socket && this.socket.connected && this.subscriptions.size > 0) {
        this.socket.emit("unsubscribe", Array.from(this.subscriptions.keys()));
      }
      this.subscriptions.clear();
      this.disconnect();
      return;
    }

    const trimmedTopic = topic.trim();
    this.subscriptions.delete(trimmedTopic);

    if (this.socket && this.socket.connected) {
      this.socket.emit("unsubscribe", trimmedTopic);
    }

    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Publishes a custom event to a realtime topic
   */
  async publish(topic: string, data: any, event?: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      this.socket.emit("publish", { topic, data, event });
      return;
    }

    await this.send("/api/realtime/publish", {
      method: "POST",
      body: {
        topic,
        data,
        event,
      },
    });
  }

  private unsubscribeFromTopic(topic: string, listener: RealtimeListener): void {
    const set = this.subscriptions.get(topic);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.subscriptions.delete(topic);
        if (this.socket && this.socket.connected) {
          this.socket.emit("unsubscribe", topic);
        }
      }
    }

    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  private ensureConnection(): void {
    if (this.isConnecting || this.isConnected) return;
    this.connect();
  }

  private connect(): void {
    if (this.socket) return;

    this.isConnecting = true;
    const socketUrl = this.client.baseUrl;

    this.socket = io(socketUrl, {
      path: "/api/socket.io",
      auth: {
        token: this.client.authStore.token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", () => {
      this.isConnecting = false;
      const topics = Array.from(this.subscriptions.keys());
      if (topics.length > 0) {
        this.socket!.emit("subscribe", topics);
      }
    });

    this.socket.on("disconnect", () => {
      this.isConnecting = false;
    });

    this.socket.on("connect_error", () => {
      this.isConnecting = false;
    });

    // Handle incoming logs
    this.socket.on("logs", (data: any) => {
      const logData = data?.log || data;
      this.dispatchMessage(logData, "logs");
    });

    this.socket.on("log", (data: any) => {
      const logData = data?.log || data;
      this.dispatchMessage(logData, "logs");
    });

    // Handle generic record events
    this.socket.on("record", (data: any) => {
      const collection = data?.collection;
      this.dispatchMessage(data, collection);
    });

    // Catch-all listener for collection or custom topics
    this.socket.onAny((eventName: string, ...args: any[]) => {
      if (
        [
          "connect",
          "disconnect",
          "connect_error",
          "connected",
          "subscriptions",
          "pong",
        ].includes(eventName)
      ) {
        return;
      }
      const data = args[0];
      this.dispatchMessage(data, eventName);
    });
  }

  private dispatchMessage(data: any, explicitTopic?: string): void {
    if (!data) return;

    const collection = explicitTopic || data.collection || data.topic;
    const recordId = data.record?.id;

    for (const [topic, listeners] of this.subscriptions.entries()) {
      let isMatch = false;

      if (topic === "*" || topic === collection) {
        isMatch = true;
      } else if (recordId && topic === `${collection}/${recordId}`) {
        isMatch = true;
      } else if (topic === `${collection}/*`) {
        isMatch = true;
      }

      if (isMatch) {
        for (const listener of listeners) {
          try {
            listener(data);
          } catch (err) {
            console.error("[AlsaBase Realtime] Listener error:", err);
          }
        }
      }
    }
  }

  private disconnect(): void {
    this.isConnecting = false;
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }
  }
}

