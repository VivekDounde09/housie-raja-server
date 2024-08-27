import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import {
  AuthenticatedRequest,
  BaseController,
  JwtAuthGuard,
  RolesGuard,
  UserType,
  Roles,
  AccessGuard,
} from '@Common';
import { UsersService } from './users.service';
import {
  GetUsersRequestDto,
  UpdateProfileDetailsRequestDto,
  UpdateProfileImageRequestDto,
  UpdateUserProfileRequestDto,
} from './dto';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('users')
export class UsersController extends BaseController {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  @Roles(UserType.Admin)
  @UseGuards(RolesGuard)
  @Get()
  async getUsers(@Query() query: GetUsersRequestDto) {
    return await this.usersService.getAll({
      search: query.search,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const ctx = this.getContext(req);
    if (ctx.user.type === UserType.Admin) {
      throw new NotFoundException('user not exists');
    }
    return await this.usersService.getProfile(BigInt(ctx.user.id));
  }

  @Patch('me')
  async updateProfileDetails(
    @Req() req: AuthenticatedRequest,
    @Body() data: UpdateProfileDetailsRequestDto,
  ) {
    if (data.mobile && !data.dialCode) {
      throw new BadRequestException();
    }
    const ctx = this.getContext(req);
    await this.usersService.updateProfileDetails({
      userId: BigInt(ctx.user.id),
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
    });
    return { status: 'success' };
  }

  @Roles(UserType.Admin)
  @UseGuards(RolesGuard)
  @Get(':userId')
  async getUserProfile(@Param('userId', ParseIntPipe) userId: number) {
    return await this.usersService.getProfile(BigInt(userId));
  }

  @Roles(UserType.Admin)
  @UseGuards(RolesGuard)
  @Patch(':userId')
  async updateUserProfileDetails(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() data: UpdateUserProfileRequestDto,
  ) {
    return await this.usersService.updateProfileDetailsByAdministrator({
      userId: BigInt(userId),
      fullname: data.fullname,
      dialCode: data.dialCode,
      mobile: data.mobile,
    });
  }

  @Post('me/profile-image')
  updateProfileImage(
    @Req() req: AuthenticatedRequest,
    @Body() data: UpdateProfileImageRequestDto,
  ) {
    const ctx = this.getContext(req);
    return this.usersService.updateProfileImage(
      BigInt(ctx.user.id),
      data.profileImage,
    );
  }

  @Post('view/tutorial')
  async viewTutorial(@Req() req: AuthenticatedRequest) {
    return await this.usersService.viewTutorial(Number(req.user.id));
  }

  // @Post('refer')
  // async createReferral(@Req() req: AuthenticatedRequest) {
  //   return await this.usersService.createReferral(Number(req.user.id));
  // }

  @ApiParam({ name: 'status', enum: UserStatus })
  @Post(':userId/:status')
  async setUserStatus(
    @Req() req: AuthenticatedRequest,
    @Param('userId', new ParseIntPipe()) userId: number,
    @Param('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ) {
    if (req.user.type !== UserType.Admin) {
      throw new ForbiddenException();
    }
    await this.usersService.setStatus(BigInt(userId), status);
    return { status: 'success' };
  }
}
