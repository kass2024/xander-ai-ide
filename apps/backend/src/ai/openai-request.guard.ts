import { BadRequestException } from '@nestjs/common';

/** Endpoints that can hit OpenAI outside chat/agent must set userRequested: true in the body. */
export function assertUserRequestedOpenAI(
  body: { userRequested?: boolean } | undefined,
  feature: string,
): void {
  if (process.env.OPENAI_ALLOW_BACKGROUND === 'true') return;
  if (!body?.userRequested) {
    throw new BadRequestException(
      `${feature} blocked: requires an explicit user action (userRequested: true).`,
    );
  }
}
