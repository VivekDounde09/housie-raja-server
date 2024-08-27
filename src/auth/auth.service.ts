import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { OtpTransport } from '@prisma/client';
import { JwtPayload, UserType } from '@Common';
import { SendCodeRequestType } from './dto';
import { UsersService } from '../users';
import {
  OtpContext,
  OtpService,
  SendCodeResponse,
  VerifyCodeResponse,
} from '../otp';

export type ValidAuthResponse = {
  accessToken: string;
  type: UserType;
  userId: bigint;
};

export type InvalidVerifyCodeResponse = {
  mobile?: VerifyCodeResponse;
  email?: VerifyCodeResponse;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
  ) {}

  private generateJwt(payload: JwtPayload, options?: JwtSignOptions): string {
    return this.jwtService.sign(payload, options);
  }

  decodeJwt(token: string) {
    const decoded: {
      sub: string;
    } = this.jwtService.verify(token);
    return decoded;
  }

  async sendCode(
    target: string,
    transport: OtpTransport,
    type: SendCodeRequestType,
  ): Promise<SendCodeResponse> {
    if (type === SendCodeRequestType.Register) {
      if (
        transport === OtpTransport.Mobile &&
        (await this.usersService.isMobileExist(target))
      ) {
        throw new Error('Mobile already in use');
      }

      return await this.otpService.send({
        context: OtpContext.Register,
        target,
        ...{ transport },
      });
    } else {
      return await this.otpService.send({
        context: OtpContext.Register,
        target,
        ...{ transport },
      });
    }
  }

  async login(userId: bigint, type: UserType): Promise<ValidAuthResponse> {
    return {
      accessToken: this.generateJwt({
        sub: userId.toString(),
        type,
      }),
      type,
      userId,
    };
  }

  async hasViewedTutorial(userId: number) {
    return await this.usersService.hasViewedTutorial(BigInt(userId));
  }

  async getReferralCode(userId: number) {
    return await this.usersService.getReferralCode(userId);
  }

  async registerUser(data: {
    fullname: string;
    dialCode: string;
    mobile: string;
    mobileVerificationCode?: string;
    isBot: boolean;
    code?: string;
  }): Promise<InvalidVerifyCodeResponse | ValidAuthResponse> {
    const [verifyMobileOtpResponse] = await Promise.all([
      data.mobile &&
        this.otpService.verify(
          data.mobileVerificationCode || '',
          data.mobile,
          OtpTransport.Mobile,
        ),
    ]);
    if (
      verifyMobileOtpResponse &&
      !verifyMobileOtpResponse.status &&
      data.isBot === false
    ) {
      return {
        mobile: verifyMobileOtpResponse || undefined,
      };
    }

    const user = await this.usersService.create({
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
      isBot: data.isBot,
    });
    if (user && data.code) {
      await this.usersService.applyReferral(data.code);
    }
    return {
      accessToken: this.generateJwt({
        sub: user.id.toString(),
        type: UserType.User,
      }),
      type: UserType.User,
      userId: user.id,
    };
  }

  async registerBotUser(data: {
    fullname: string;
    dialCode: string;
    mobile: string;
  }): Promise<ValidAuthResponse> {
    const user = await this.usersService.create({
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
      isBot: true,
    });
    return {
      accessToken: this.generateJwt({
        sub: user.id.toString(),
        type: UserType.User,
      }),
      type: UserType.User,
      userId: user.id,
    };
  }

  async loginUser(data: {
    mobile: string;
    mobileVerificationCode: string;
  }): Promise<InvalidVerifyCodeResponse | ValidAuthResponse> {
    const user = await this.usersService.getByMobile(data.mobile);
    if (!user) {
      throw new NotFoundException('User Not registered yet.');
    }
    if (user.isBot === false) {
      const [verifyMobileOtpResponse] = await Promise.all([
        data.mobile &&
          this.otpService.verify(
            data.mobileVerificationCode || '',
            data.mobile,
            OtpTransport.Mobile,
          ),
      ]);
      if (verifyMobileOtpResponse && !verifyMobileOtpResponse.status) {
        return {
          mobile: verifyMobileOtpResponse || undefined,
        };
      }
    }
    await this.usersService.updateLastLogin(user?.id);
    return {
      accessToken: this.generateJwt({
        sub: user.id.toString(),
        type: UserType.User,
      }),
      type: UserType.User,
      userId: user.id,
    };
  }

  async loginBusiness(data: {
    email: string;
    emailVerificationCode: string;
  }): Promise<InvalidVerifyCodeResponse | ValidAuthResponse> {
    const admin = await this.usersService.getAdminByEmail(data.email);
    if (!admin) {
      throw new NotFoundException('User does not exists with this mobile');
    }
    const [verifyEmailOtpResponse] = await Promise.all([
      data.email &&
        this.otpService.verify(
          data.emailVerificationCode || '',
          data.email,
          OtpTransport.Email,
        ),
    ]);
    if (verifyEmailOtpResponse && !verifyEmailOtpResponse.status) {
      return {
        email: verifyEmailOtpResponse || undefined,
      };
    }
    return {
      accessToken: this.generateJwt({
        sub: admin.id.toString(),
        type: UserType.Business,
      }),
      type: UserType.Business,
      userId: admin.id,
    };
  }
}
