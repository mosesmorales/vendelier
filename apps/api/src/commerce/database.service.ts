import { Injectable, type OnApplicationShutdown, ServiceUnavailableException } from "@nestjs/common";
import { createDatabase } from "@vendelier/database";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private client?: ReturnType<typeof createDatabase>;

  get connection() {
    if (this.client) {
      return this.client;
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new ServiceUnavailableException("The database is not configured.");
    }
    this.client = createDatabase(connectionString);
    return this.client;
  }

  async onApplicationShutdown() {
    await this.client?.$disconnect();
  }
}
