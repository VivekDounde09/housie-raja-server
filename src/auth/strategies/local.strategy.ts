import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Strategy } from 'passport-local';
import { ValidatedUser } from '@Common';
import { LOCAL_AUTH } from '../auth.constants';
import { UsersService } from '../../users';
import { AdminService } from '../../admin';
import _ from 'lodash';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, LOCAL_AUTH) {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
  ) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<ValidatedUser> {
    const user: false | ValidatedUser | null =
      await this.adminService.validateCredentials(
        email.toLowerCase(),
        password,
      );

    if (user) return user;

    if (user === false || _.isNull(user)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    throw new UnauthorizedException('User does not exist');
  }
}
