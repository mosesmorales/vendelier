import { Module } from "@nestjs/common";
import { CommerceModule } from "./commerce/commerce.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({ imports: [HealthModule, CommerceModule] })
export class AppModule {}
