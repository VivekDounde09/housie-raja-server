import { join } from 'path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  Admin,
  OtpTransport,
  Prisma,
  User,
  UserMeta,
  UserStatus,
} from '@prisma/client';
import { StorageService, UtilsService } from '@Common';
import { userConfigFactory } from '@Config';
import { PrismaService } from '../prisma';
import { OtpContext, OtpService, SendCodeResponse } from '../otp';
import { WalletService } from 'src/wallet/wallet.service';
import { Decimal } from '@prisma/client/runtime/library';
import { SystemService } from 'src/system';

@Injectable()
export class UsersService {
  constructor(
    @Inject(userConfigFactory.KEY)
    private readonly config: ConfigType<typeof userConfigFactory>,
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly storageService: StorageService,
    private readonly otpService: OtpService,
    private readonly walletService: WalletService,
    private readonly systemService: SystemService,
  ) {}

  private getProfileImageUrl(profileImage: string): string {
    return this.storageService.getFileUrl(
      profileImage,
      this.config.profileImagePath,
    );
  }

  private hashPassword(password: string): { salt: string; hash: string } {
    const salt = this.utilsService.generateSalt(this.config.passwordSaltLength);
    const hash = this.utilsService.hashPassword(
      password,
      salt,
      this.config.passwordHashLength,
    );
    return { salt, hash };
  }

  private isValidUsername(username: string): boolean {
    return /^[a-z][a-z0-9_]{3,20}$/.test(username);
  }

  async isUsernameExist(
    username: string,
    excludeUserId?: bigint,
  ): Promise<boolean> {
    return (
      (await this.prisma.user.count({
        where: {
          username,
          NOT: {
            id: excludeUserId,
          },
        },
      })) !== 0
    );
  }

  async updateLastLogin(id: bigint) {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date().toISOString(),
      },
    });
  }

  async isMobileExist(
    mobile: string,
    excludeUserId?: bigint,
  ): Promise<boolean> {
    return (
      (await this.prisma.user.count({
        where: {
          mobile,
          NOT: {
            id: excludeUserId,
          },
        },
      })) !== 0
    );
  }

  async hasViewedTutorial(userId: bigint) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        hasViewedTutorial: true,
      },
    });
    return user.hasViewedTutorial;
  }

  async getReferralCode(userId: number) {
    let user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        referralCode: true,
      },
    });
    if (!user.referralCode) {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          referralCode: this.utilsService.generateRandomToken(10).toUpperCase(),
        },
        select: {
          referralCode: true,
        },
      });
    }
    return user?.referralCode;
  }

  async getById(userId: bigint) {
    return await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      include: {
        wallet: {
          select: {
            amount: true,
          },
        },
      },
    });
  }

  async getByMobile(mobile: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        mobile,
      },
    });
  }

  async getAdminByEmail(email: string): Promise<Admin | null> {
    return await this.prisma.admin.findUnique({
      where: {
        email,
      },
    });
  }

  async getMetaById(userId: bigint): Promise<UserMeta> {
    return await this.prisma.userMeta.findUniqueOrThrow({
      where: {
        userId,
      },
    });
  }

  async create(data: {
    fullname: string;
    dialCode: string;
    mobile: string;
    isBot: boolean;
  }) {
    if (data.mobile && (await this.isMobileExist(data.mobile))) {
      throw new Error('Mobile already exist');
    }

    return await this.prisma.user.create({
      data: {
        fullname: data.fullname,
        dialCode: data.dialCode,
        lastLoginAt: new Date().toISOString(),
        referralCode: this.utilsService.generateRandomToken(10).toUpperCase(),
        mobile: data.mobile,
        isBot: data.isBot,
        wallet: {
          create: {
            amount: data.isBot ? 1000 : 0,
          },
        },
        meta: {
          create: {},
        },
      },
      select: {
        id: true,
      },
    });
  }

  async getProfile(userId: bigint) {
    const user = await this.getById(userId);
    if (user.profileImage) {
      user.profileImage = this.getProfileImageUrl(user.profileImage);
    }
    return Object.assign(user, {
      balance: user.wallet?.amount || 0,
      wallet: null,
    });
  }

  async getReferralAmount() {
    const amount = await this.systemService.getAdminSettings();
    return amount.UserReferralAmountSettings;
  }

  async applyReferral(code: string) {
    const referrer = await this.prisma.user.findFirst({
      where: { referralCode: code.toUpperCase() },
    });
    if (referrer) {
      const referralAmount = await this.getReferralAmount();
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: referrer.id },
          data: { referralCount: { increment: 1 } },
        });
        await this.walletService.addReferralBalance(
          referrer.id,
          new Decimal(referralAmount),
          {
            tx,
            context: 'Referrals',
            entityId: referrer.id,
          },
        );
      });
    }
  }

  async updateProfileDetails(
    data: {
      userId: bigint;
      fullname?: string;
      dialCode?: string;
      mobile?: string;
    },
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<User> {
    const client = options?.tx ? options.tx : this.prisma;

    if (data.mobile && (await this.isMobileExist(data.mobile, data.userId))) {
      throw new Error('Mobile already exist');
    }

    return await client.user.update({
      data: {
        fullname: data.fullname,
        dialCode: data.dialCode,
        mobile: data.mobile,
      },
      where: {
        id: data.userId,
      },
    });
  }

  async updateProfileDetailsByAdministrator(data: {
    userId: bigint;
    fullname?: string;
    dialCode?: string;
    mobile?: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.updateProfileDetails(
        {
          userId: data.userId,
          fullname: data.fullname,

          dialCode: data.dialCode,
          mobile: data.mobile,
        },
        { tx },
      );
      return user;
    });
  }

  async updateProfileImage(
    userId: bigint,
    profileImage: string,
  ): Promise<{ profileImage: string | null }> {
    const user = await this.getById(userId);

    return await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { profileImage },
      });

      if (user.profileImage) {
        // Remove previous profile image from storage
        await this.storageService.removeFile(
          join(this.config.profileImagePath, user.profileImage),
        );
      }
      await this.storageService.move(
        profileImage,
        this.config.profileImagePath,
      );

      return {
        profileImage: this.getProfileImageUrl(profileImage),
      };
    });
  }

  async changePassword(
    userId: bigint,
    oldPassword: string,
    newPassword: string,
  ): Promise<User> {
    const user = await this.getById(userId);
    const userMeta = await this.getMetaById(user.id);

    const hashedPassword = this.utilsService.hashPassword(
      oldPassword,
      userMeta.passwordSalt || '',
      userMeta.passwordHash
        ? userMeta.passwordHash.length / 2
        : this.config.passwordHashLength,
    );

    if (hashedPassword !== userMeta.passwordHash)
      throw new Error('Password does not match');

    const { salt, hash } = this.hashPassword(newPassword);
    const passwordSalt = salt;
    const passwordHash = hash;

    await this.prisma.userMeta.update({
      data: {
        passwordHash,
        passwordSalt,
      },
      where: {
        userId,
      },
    });
    return user;
  }

  async sendResetPasswordVerificationCode(mobile?: string) {
    let user: User | null | undefined;
    if (!user && mobile) user = await this.getByMobile(mobile);
    if (!user) throw new Error('User does not exist');

    const response: { email?: SendCodeResponse; mobile?: SendCodeResponse } =
      {};

    if (mobile) {
      response.mobile = await this.otpService.send({
        context: OtpContext.ResetPassword,
        target: mobile,
        transport: OtpTransport.Mobile,
      });
    }

    return response;
  }

  async setStatus(userId: bigint, status: UserStatus): Promise<User> {
    return await this.prisma.user.update({
      data: { status },
      where: {
        id: userId,
      },
    });
  }

  async getAll(options?: {
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{
    count: number;
    skip: number;
    take: number;
    data: User[];
  }> {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };
    const where: Prisma.UserWhereInput = {};
    if (options?.search) {
      const buildSearchFilter = (search: string): Prisma.UserWhereInput[] => [
        {
          fullname: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          username: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          mobile: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
      const search = options.search.trim().split(' ');
      if (search.length === 0) {
        where.OR = buildSearchFilter(options.search);
      } else {
        where.AND = [];
        for (const part of search) {
          where.AND.push({
            OR: buildSearchFilter(part),
          });
        }
      }
    }

    const totalUsers = await this.prisma.user.count({
      where,
    });
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: Prisma.SortOrder.desc },
      skip: options?.skip || 0,
      take: options?.take || 10,
    });
    const response = await Promise.all(
      users.map(async (user) => {
        return {
          ...user,
          profileImage: user.profileImage
            ? this.getProfileImageUrl(user.profileImage)
            : null,
        };
      }),
    );

    return {
      count: totalUsers,
      skip: pagination.skip,
      take: pagination.take,
      data: response,
    };
  }

  // async createReferral(userId: number) {
  //   const code = this.utilsService.generateRandomToken(10);
  //   const referral = await this.prisma.referrals.create({
  //     data: {
  //       code: code.toUpperCase(),
  //       byId: userId,
  //     },
  //   });
  //   return referral.code;
  // }

  async viewTutorial(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hasViewedTutorial: true,
      },
    });
    return 'success';
  }
}
