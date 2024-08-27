import { Injectable, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class SeedService implements OnModuleInit {
  async onModuleInit() {
    try {
      // const { stderr } =
      await execPromise('npm run db:seed');
      // if (stderr) {
      //   console.error('Seed error:', stderr);
      // }
    } catch (error) {
      console.error('Seed command failed:', error);
    }
  }
}
