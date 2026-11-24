import { Injectable, type OnApplicationShutdown, ServiceUnavailableException } from "@nestjs/common";
import { createDatabase, type PrismaClient } from "@vendelier/database";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private client?: PrismaClient;

  get connection(): PrismaClient {
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
