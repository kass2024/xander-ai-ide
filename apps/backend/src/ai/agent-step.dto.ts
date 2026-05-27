import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ToolCallFunctionDto {
  @IsString()
  name: string;

  @IsString()
  arguments: string;
}

class ToolCallDto {
  @IsString()
  id: string;

  @IsIn(['function'])
  type: 'function';

  @ValidateNested()
  @Type(() => ToolCallFunctionDto)
  function: ToolCallFunctionDto;
}

class AgentMessageDto {
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role: 'system' | 'user' | 'assistant' | 'tool';

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  tool_call_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolCallDto)
  tool_calls?: ToolCallDto[];

  @IsOptional()
  @IsString()
  name?: string;
}

export class AgentStepDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentMessageDto)
  messages: AgentMessageDto[];

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
