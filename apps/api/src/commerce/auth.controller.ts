import type { ServerResponse } from "node:http";
import { Body, Controller, Get, Header, Headers, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { LoginDto, RegisterDto } from "./dto.js";
import { clearSessionCookie } from "./security.js";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: ServerResponse) {
    const { body, cookie } = await this.auth.register(input);
    response.setHeader("Set-Cookie", cookie);
    return body;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: ServerResponse) {
    const { body, cookie } = await this.auth.login(input);
    response.setHeader("Set-Cookie", cookie);
    return body;
  }

  @Get("session")
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth()
  async session(@Headers("cookie") cookie: string | undefined) {
    const { session } = await this.auth.requireSession(cookie);
    return session;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: ServerResponse) {
    response.setHeader("Set-Cookie", clearSessionCookie());
  }
}
