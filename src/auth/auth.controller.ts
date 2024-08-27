import {
  Req,
  Res,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  Inject,
  Body,
  UnprocessableEntityException,
  Get,
  Redirect,
} from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import { OtpTransport } from '@prisma/client';
import {
  AuthenticatedRequest,
  BaseController,
  JwtAuthGuard,
  UserType,
  UtilsService,
  ValidatedUser,
} from '@Common';
import { appConfigFactory, authConfigFactory } from '@Config';
import {
  AuthService,
  InvalidVerifyCodeResponse,
  ValidAuthResponse,
} from './auth.service';
import { GoogleOAuthGuard, LocalAuthGuard } from './guards';
import {
  RegisterUserRequestDto,
  SendCodeRequestDto,
  LoginRequestDto,
  LoginRequestDtoAdmin,
  RegisterBotUserRequestDto,
  EmailLoginRequestDto,
} from './dto';
import { SendCodeResponse } from '../otp';

@ApiTags('Auth')
@Controller('auth')
export class AuthController extends BaseController {
  constructor(
    @Inject(appConfigFactory.KEY)
    private readonly appConfig: ConfigType<typeof appConfigFactory>,
    @Inject(authConfigFactory.KEY)
    private readonly config: ConfigType<typeof authConfigFactory>,
    private readonly authService: AuthService,
    private readonly utilsService: UtilsService,
  ) {
    super();
  }

  private getCookieOptions(options?: CookieOptions) {
    const isProduction = this.utilsService.isProduction();
    return {
      expires: options?.expires,
      domain:
        options?.domain !== undefined ? options.domain : this.appConfig.domain,
      httpOnly: options?.httpOnly !== undefined ? options.httpOnly : true,
      sameSite:
        options?.sameSite !== undefined
          ? options.sameSite
          : isProduction
            ? 'strict'
            : 'none',
      secure: options?.secure !== undefined ? options.secure : true,
    };
  }

  private setCookie(
    res: Response,
    key: string,
    value: string,
    options?: CookieOptions,
  ): void {
    res.cookie(key, value, this.getCookieOptions(options));
  }

  private removeCookie(
    res: Response,
    key: string,
    options?: CookieOptions,
  ): void {
    res.clearCookie(key, this.getCookieOptions(options));
  }

  private getAuthCookie(ut: UserType) {
    return this.utilsService.getCookiePrefix(ut) + 'authToken';
  }

  private setAuthCookie(
    res: Response,
    accessToken: string,
    userType: UserType,
  ): void {
    const expirationTime = this.config.authCookieExpirationTime();

    this.setCookie(res, this.getAuthCookie(userType), accessToken, {
      expires: expirationTime,
    });
  }

  @Post('send-code')
  async sendCode(@Body() data: SendCodeRequestDto) {
    const response = {} as Record<'email' | 'mobile', SendCodeResponse>;
    if (data.email) {
      response.email = await this.authService.sendCode(
        data.email,
        OtpTransport.Email,
        data.type,
      );
    }
    if (data.mobile) {
      response.mobile = await this.authService.sendCode(
        data.mobile,
        OtpTransport.Mobile,
        data.type,
      );
    }
    return { response, message: 'OTP sent successfully' };
  }

  @Post('register')
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() data: RegisterUserRequestDto,
  ) {
    const response = await this.authService.registerUser({
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
      mobileVerificationCode: data.mobileVerificationCode,
      isBot: false,
      code: data.code,
    });

    if ((response as InvalidVerifyCodeResponse).mobile) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'You have entered invalid OTP.',
        meta: response as InvalidVerifyCodeResponse,
      });
    }

    const { accessToken, type } = response as ValidAuthResponse;
    this.setAuthCookie(res, accessToken, type);
    return { status: 'success', message: 'User registered successfully' };
  }

  @Post('bot/register')
  async botRegister(
    @Res({ passthrough: true }) res: Response,
    @Body() data: RegisterBotUserRequestDto,
  ) {
    const response = await this.authService.registerBotUser({
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
    });
    // const { accessToken, type } = response as ValidAuthResponse;
    // this.setAuthCookie(res, accessToken, type);
    return { status: 'success', token: response.accessToken };
  }

  @ApiBody({ type: () => LoginRequestDtoAdmin })
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login/admin')
  async adminLogin(@Req() req: Request & { user: ValidatedUser }) {
    const { accessToken, type } = await this.authService.login(
      req.user.id,
      req.user.type,
    );

    if (type !== UserType.Admin) throw new Error('Unauthorized');

    return {
      success: true,
      data: {
        id: req.user.id,
        authToken: accessToken,
        type,
      },
    };
  }

  @HttpCode(200)
  @Post('login/business')
  async businessLogin(
    @Req() req: Request & { user: ValidatedUser },
    @Body() data: EmailLoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.loginBusiness({
      email: data.email,
      emailVerificationCode: data.otp,
    });
    if ((response as InvalidVerifyCodeResponse).email) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'You have entered invalid OTP',
        meta: response as InvalidVerifyCodeResponse,
      });
    }
    const userMeta = response as ValidAuthResponse;
    const { accessToken, type } = await this.authService.login(
      userMeta.userId,
      userMeta.type,
    );
    this.setAuthCookie(res, accessToken, type);
    return {
      status: 'success',
      meta: {
        accessToken,
        type,
      },
    };
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Body() data: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.loginUser({
      mobile: data.mobile,
      mobileVerificationCode: data.otp,
    });
    if ((response as InvalidVerifyCodeResponse).mobile) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Invalid verification code',
        meta: response as InvalidVerifyCodeResponse,
      });
    }
    const userMeta = response as ValidAuthResponse;
    const { accessToken, type } = await this.authService.login(
      userMeta.userId,
      userMeta.type,
    );
    const viewedTutorial = await this.authService.hasViewedTutorial(
      Number(userMeta.userId),
    );
    const referralCode = await this.authService.getReferralCode(
      Number(userMeta.userId),
    );
    this.setAuthCookie(res, accessToken, type);
    return {
      status: 'success',
      message: 'User logged in successfully',
      meta: {
        accessToken,
        type,
        viewedTutorial,
        referralCode,
      },
    };
  }

  @ApiExcludeEndpoint()
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleOAuth() {}

  @ApiExcludeEndpoint()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  @Redirect()
  async googleWebOAuthCallback(
    @Req() req: Request & { user: ValidatedUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, type } = await this.authService.login(
      req.user.id,
      req.user.type,
    );
    this.setAuthCookie(res, accessToken, type);
    return {
      url: this.appConfig.appWebUrl as string,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = this.getContext(req);
    this.removeCookie(res, this.getAuthCookie(ctx.user.type));
    return { status: 'success' };
  }
}
