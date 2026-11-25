import { Module } from "@nestjs/common";
import { MediaStorageService } from "../media/media-storage.service.js";
import { AppearanceController } from "./appearance.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { DatabaseService } from "./database.service.js";
import { PlatformController } from "./platform.controller.js";
import { StoreController } from "./store.controller.js";
import { StudioMediaController } from "./studio-media.controller.js";
import { StudioController } from "./studio.controller.js";
import { TeamController } from "./team.controller.js";

@Module({
  controllers: [
    AuthController,
    StudioController,
    TeamController,
    AppearanceController,
    StudioMediaController,
    StoreController,
    PlatformController,
  ],
  providers: [AuthService, DatabaseService, MediaStorageService],
})
export class CommerceModule {}
