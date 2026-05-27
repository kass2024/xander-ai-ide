import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AIRouter } from './ai.router';
import { MultiModelService } from './multi-model.service';
import { ProjectBuilderService } from './project-builder.service';
import { UsersModule } from '../users/users.module';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [UsersModule, RepoModule],
  controllers: [AiController],
  providers: [AiService, AIRouter, MultiModelService, ProjectBuilderService],
  exports: [AiService, AIRouter, MultiModelService, ProjectBuilderService],
})
export class AiModule {}
