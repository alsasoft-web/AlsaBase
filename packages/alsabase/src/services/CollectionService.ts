import { BaseService } from "./BaseService";
import type {
  CollectionModel,
  ListResult,
  ListOptions,
  CommonOptions,
  TableIndexInfo,
} from "../types";

export class CollectionService extends BaseService {
  /**
   * Returns a list of all collections (Superuser required)
   */
  async getFullList(options?: CommonOptions): Promise<CollectionModel[]> {
    const res = await this.send<{ items: CollectionModel[]; total: number }>(
      "/api/collections",
      {
        method: "GET",
        ...options,
      }
    );
    return res.items || [];
  }

  /**
   * Returns a paginated list of collections
   */
  async getList(
    page: number = 1,
    perPage: number = 30,
    options?: ListOptions
  ): Promise<ListResult<CollectionModel>> {
    const all = await this.getFullList(options);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const items = all.slice(start, end);
    const total = all.length;
    const totalPages = Math.ceil(total / perPage) || 1;

    return {
      page,
      perPage,
      totalItems: total,
      totalPages,
      items,
    };
  }

  /**
   * Returns a single collection schema by its name or ID (Superuser required)
   */
  async getOne(
    idOrName: string,
    options?: CommonOptions
  ): Promise<CollectionModel> {
    return this.send<CollectionModel>(
      `/api/collections/${encodeURIComponent(idOrName)}/schema`,
      {
        method: "GET",
        ...options,
      }
    );
  }

  /**
   * Returns the schema and column definitions of a table/collection (Superuser required)
   * Alias for getOne()
   */
  async getSchema(
    idOrName: string,
    options?: CommonOptions
  ): Promise<CollectionModel> {
    return this.getOne(idOrName, options);
  }

  /**
   * Returns the schema of a table/collection (Superuser required)
   * Alias for getOne()
   */
  async getTableSchema(
    idOrName: string,
    options?: CommonOptions
  ): Promise<CollectionModel> {
    return this.getOne(idOrName, options);
  }

  /**
   * Creates a new collection schema
   */
  async create(
    data: Partial<CollectionModel>,
    options?: CommonOptions
  ): Promise<CollectionModel> {
    return this.send<CollectionModel>("/api/collections", {
      method: "POST",
      body: data,
      ...options,
    });
  }

  /**
   * Updates an existing collection schema
   */
  async update(
    idOrName: string,
    data: Partial<CollectionModel>,
    options?: CommonOptions
  ): Promise<CollectionModel> {
    return this.send<CollectionModel>(
      `/api/collections/${encodeURIComponent(idOrName)}`,
      {
        method: "PATCH",
        body: data,
        ...options,
      }
    );
  }

  /**
   * Deletes a collection schema
   */
  async delete(idOrName: string, options?: CommonOptions): Promise<boolean> {
    await this.send(`/api/collections/${encodeURIComponent(idOrName)}`, {
      method: "DELETE",
      ...options,
    });
    return true;
  }

  /**
   * Truncates all records in a collection
   */
  async truncate(idOrName: string, options?: CommonOptions): Promise<boolean> {
    await this.send(
      `/api/collections/${encodeURIComponent(idOrName)}/truncate`,
      {
        method: "DELETE",
        ...options,
      }
    );
    return true;
  }

  /**
   * Returns all active SQLite indexes for a collection/table (Superuser required)
   */
  async getIndexes(
    idOrName: string,
    options?: CommonOptions
  ): Promise<TableIndexInfo[]> {
    const res = await this.send<{ items: TableIndexInfo[]; total: number }>(
      `/api/collections/${encodeURIComponent(idOrName)}/indexes`,
      {
        method: "GET",
        ...options,
      }
    );
    return res.items || [];
  }

  /**
   * Creates a new index for a collection/table (Superuser required)
   */
  async createIndex(
    idOrName: string,
    data: { name?: string; columns?: string[]; unique?: boolean; rawSql?: string },
    options?: CommonOptions
  ): Promise<{ name: string; sql: string }> {
    return this.send<{ name: string; sql: string }>(
      `/api/collections/${encodeURIComponent(idOrName)}/indexes`,
      {
        method: "POST",
        body: data,
        ...options,
      }
    );
  }

  /**
   * Drops an index from a collection/table (Superuser required)
   */
  async dropIndex(
    idOrName: string,
    indexName: string,
    options?: CommonOptions
  ): Promise<boolean> {
    const res = await this.send<{ success: boolean }>(
      `/api/collections/${encodeURIComponent(idOrName)}/indexes/${encodeURIComponent(indexName)}`,
      {
        method: "DELETE",
        ...options,
      }
    );
    return res.success;
  }
}
