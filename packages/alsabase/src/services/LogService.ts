import { BaseService } from "./BaseService";
import type {
  LogModel,
  LogListOptions,
  LogStats,
  LogTimelineItem,
  ListResult,
  CommonOptions,
} from "../types";

export class LogService extends BaseService {
  /**
   * Returns a paginated list of system access and error logs (Superuser required)
   */
  async getList(
    page: number = 1,
    perPage: number = 50,
    options?: LogListOptions
  ): Promise<ListResult<LogModel>> {
    const query: Record<string, any> = {
      page,
      limit: perPage,
      ...options,
    };

    const res = await this.send<{
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      items: LogModel[];
    }>("/api/logs", {
      method: "GET",
      query,
      ...options,
    });

    return {
      page: res.page,
      perPage: res.limit,
      totalItems: res.total,
      totalPages: res.totalPages,
      items: res.items,
    };
  }

  /**
   * Returns timeline distribution of system requests and errors
   */
  async getTimeline(
    options?: CommonOptions
  ): Promise<{ timeline: LogTimelineItem[] }> {
    return this.send<{ timeline: LogTimelineItem[] }>("/api/logs/timeline", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Returns summary stats for server logs
   */
  async getStats(options?: CommonOptions): Promise<LogStats> {
    return this.send<LogStats>("/api/logs/stats", {
      method: "GET",
      ...options,
    });
  }

  /**
   * Deletes a batch of logs by IDs or all matching filter criteria
   */
  async deleteBatch(
    params: {
      ids?: string[];
      all?: boolean;
      level?: string;
      search?: string;
      includeSuperusers?: boolean;
    },
    options?: CommonOptions
  ): Promise<any> {
    return this.send("/api/logs/delete-batch", {
      method: "POST",
      body: params,
      ...options,
    });
  }

  /**
   * Clears all system logs
   */
  async clear(options?: CommonOptions): Promise<boolean> {
    await this.send("/api/logs", {
      method: "DELETE",
      ...options,
    });
    return true;
  }
}
