import { Module } from '@nestjs/common';
import { RepoController } from './repo.controller';
import { RepoService } from './repo.service';

@Module({
  controllers: [RepoController],
  providers: [RepoService],
  exports: [RepoService],
})
export class RepoModule {}
