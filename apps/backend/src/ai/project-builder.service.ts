import { Injectable, BadRequestException } from '@nestjs/common';
import { MultiModelService } from './multi-model.service';
import { StreamEvent } from './stream.types';

export interface ProjectBuilderRequest {
  instruction: string;
  context?: {
    repositoryPath?: string;
    projectTree?: string;
    language?: string;
    framework?: string;
  };
  model?: string;
}

export interface ProjectPlan {
  title: string;
  description: string;
  files: Array<{ path: string; description: string; language?: string }>;
  folders: string[];
  commands?: string[];
}

const PROJECT_BUILDER_SYSTEM = `You are Xander AI Project Builder — an expert at creating complete, production-ready software projects.

When given a project request, you MUST:
1. Analyze the requirements thoroughly
2. Create a complete file tree with ALL necessary files
3. Generate REAL, WORKING code for each file — not placeholders or stubs
4. Include proper structure: config, routes, models, views, assets, database schema, README
5. Use modern, polished UI (responsive CSS, clear typography, accessible colors) — never bare HTML

PHP / XAMPP rules (critical):
- Call session_start() ONCE only (entry point or a guarded bootstrap — never in both index and header)
- Use a BASE_URL constant for subdirectory installs (e.g. /sample) for links AND asset paths
- Router must handle /index.php, trailing slashes, and direct file access
- Prefer front-controller routing in index.php; views must not duplicate session_start()
- Include CSRF on forms, prepared statements for DB, htmlspecialchars on output

For large projects, respond in TWO phases:

PHASE 1 — PLAN (first response):
Return ONLY a JSON plan:
\`\`\`json
{
  "title": "Project Name",
  "description": "Brief description",
  "folders": ["config", "includes", "assets/css", "assets/js"],
  "files": [
    { "path": "index.php", "description": "Main entry point with routing", "language": "php" },
    { "path": "config/db.php", "description": "Database connection", "language": "php" }
  ],
  "commands": ["composer install"]
}
\`\`\`

PHASE 2 — GENERATE (when asked to generate a specific file):
Return ONLY the complete file content — no markdown fences, no explanations.
Write production-quality code with proper error handling, security, and comments where needed.`;

@Injectable()
export class ProjectBuilderService {
  constructor(private multiModel: MultiModelService) {}

  async createPlan(userId: string, request: ProjectBuilderRequest): Promise<ProjectPlan> {
    const contextParts: string[] = [];
    if (request.context?.repositoryPath) {
      contextParts.push(`Workspace: ${request.context.repositoryPath}`);
    }
    if (request.context?.projectTree) {
      contextParts.push(`Existing structure:\n${request.context.projectTree}`);
    }
    if (request.context?.language) {
      contextParts.push(`Preferred language: ${request.context.language}`);
    }
    if (request.context?.framework) {
      contextParts.push(`Framework: ${request.context.framework}`);
    }

    const result = await this.multiModel.complete(request.model, 'project_builder', {
      messages: [
        { role: 'system', content: PROJECT_BUILDER_SYSTEM },
        {
          role: 'user',
          content: `Create a complete project plan for:\n\n${request.instruction}\n\n${contextParts.join('\n')}\n\nReturn the JSON plan with ALL files needed for a complete, working project.\n\nREQUIREMENTS:\n- Minimum 15 files for a full project\n- Include: entry point, config, database schema, all pages/views, CSS, JS, reusable components (header/footer), README\n- For PHP projects: index.php, login.php, config/db.php, includes/header.php, includes/footer.php, assets/css/style.css, assets/js/app.js, database/schema.sql\n- For web apps: all pages mentioned in the request\n- Each file must have a clear description of its purpose`,
        },
      ],
      maxTokens: 8000,
      temperature: 0.3,
    });

    return this.parsePlan(result.content);
  }

  async *generateProject(
    userId: string,
    request: ProjectBuilderRequest,
    onUsage?: (tokens: number, cost: number, model: string) => void,
  ): AsyncGenerator<StreamEvent> {
    yield { type: 'step', step: 'planning', message: 'Analyzing request and creating project plan...' };

    let plan: ProjectPlan;
    try {
      plan = await this.createPlan(userId, request);
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Failed to create plan' };
      return;
    }

    yield {
      type: 'plan',
      plan: {
        title: plan.title,
        description: plan.description,
        fileCount: plan.files.length,
        folders: plan.folders,
        files: plan.files.map((f) => ({ path: f.path, description: f.description })),
      },
    };

    for (const folder of plan.folders) {
      yield { type: 'folder_start', path: folder };
      yield { type: 'folder_complete', path: folder };
    }

    let totalTokens = 0;
    let totalCost = 0;
    let filesGenerated = 0;

    for (const fileSpec of plan.files) {
      yield { type: 'file_start', path: fileSpec.path, language: fileSpec.language };
      yield { type: 'step', step: 'writing', message: `Writing ${fileSpec.path}...` };

      let fileContent = '';
      const contextInfo = [
        `Project: ${plan.title}`,
        `Description: ${plan.description}`,
        request.context?.repositoryPath ? `Workspace: ${request.context.repositoryPath}` : '',
        `Other files in project: ${plan.files.map((f) => f.path).join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n');

      try {
        const stream = this.multiModel.streamComplete(request.model, 'project_builder', {
          messages: [
            { role: 'system', content: PROJECT_BUILDER_SYSTEM },
            {
              role: 'user',
              content: `Generate the COMPLETE content for file: ${fileSpec.path}\nDescription: ${fileSpec.description}\nLanguage: ${fileSpec.language || 'auto'}\n\nProject context:\n${contextInfo}\n\nOriginal request: ${request.instruction}\n\nQuality bar:\n- Production-ready, runnable code with no TODO placeholders\n- PHP: single session_start, BASE_URL for assets/links, working router\n- CSS: modern layout (flex/grid), mobile-friendly, professional palette\n- JS: minimal vanilla or framework as appropriate\n\nReturn ONLY the raw file content. No markdown fences. No explanations.`,
            },
          ],
          maxTokens: 16000,
          temperature: 0.2,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text_delta' && chunk.delta) {
            fileContent += chunk.delta;
            yield { type: 'file_delta', path: fileSpec.path, delta: chunk.delta };
          } else if (chunk.type === 'done') {
            totalTokens += chunk.tokens || 0;
            if (chunk.model) {
              const cost = this.multiModel.calculateCost(chunk.model, chunk.tokens || 0);
              totalCost += cost;
            }
          }
        }

        fileContent = this.cleanFileContent(fileContent);
        yield { type: 'file_complete', path: fileSpec.path, content: fileContent, size: fileContent.length };
        filesGenerated++;
      } catch (err) {
        yield {
          type: 'file_error',
          path: fileSpec.path,
          message: err instanceof Error ? err.message : 'Generation failed',
        };
      }
    }

    if (plan.commands?.length) {
      for (const cmd of plan.commands) {
        yield { type: 'command_suggested', command: cmd, requiresApproval: true };
      }
    }

    onUsage?.(totalTokens, totalCost, request.model || 'auto');

    yield {
      type: 'task_complete',
      summary: {
        title: plan.title,
        filesGenerated,
        totalFiles: plan.files.length,
        tokens: totalTokens,
        cost: totalCost,
      },
    };
  }

  async *streamComposerGeneration(
    instruction: string,
    files: Array<{ path: string; content: string }>,
    model?: string,
  ): AsyncGenerator<StreamEvent> {
    yield { type: 'step', step: 'planning', message: 'Analyzing multi-file changes...' };

    const result = await this.multiModel.complete(model, 'composer', {
      messages: [
        {
          role: 'system',
          content: `You are an AI coding assistant for multi-file edits. Analyze the instruction and return a JSON plan of files to create or modify.

Return JSON:
\`\`\`json
{
  "files": [
    { "path": "relative/path.php", "action": "create", "description": "what this file does" }
  ]
}
\`\`\``,
        },
        {
          role: 'user',
          content: `Instruction: ${instruction}\n\nExisting files:\n${files.map((f) => `- ${f.path} (${f.content.length} chars)`).join('\n')}`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });

    let plannedFiles: Array<{ path: string; action: string; description: string }> = [];
    try {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || result.content;
      const parsed = JSON.parse(jsonMatch.trim());
      plannedFiles = parsed.files || [];
    } catch {
      plannedFiles = [{ path: 'output.txt', action: 'create', description: instruction }];
    }

    yield {
      type: 'plan',
      plan: {
        title: 'Composer Changes',
        fileCount: plannedFiles.length,
        files: plannedFiles.map((f) => ({ path: f.path, description: f.description })),
      },
    };

    for (const fileSpec of plannedFiles) {
      yield { type: 'file_start', path: fileSpec.path };

      const existing = files.find((f) => f.path.replace(/\\/g, '/') === fileSpec.path.replace(/\\/g, '/'));
      let fileContent = '';

      const stream = this.multiModel.streamComplete(model, 'composer', {
        messages: [
          {
            role: 'system',
            content: 'Generate complete file content. Return ONLY raw file content, no markdown fences.',
          },
          {
            role: 'user',
            content: existing
              ? `Modify file ${fileSpec.path} according to: ${instruction}\n\nCurrent content:\n${existing.content}\n\nReturn the complete updated file.`
              : `Create file ${fileSpec.path}: ${fileSpec.description}\n\nContext: ${instruction}\n\nReturn complete file content.`,
          },
        ],
        maxTokens: 16000,
        temperature: 0.2,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text_delta' && chunk.delta) {
          fileContent += chunk.delta;
          yield { type: 'file_delta', path: fileSpec.path, delta: chunk.delta };
        }
      }

      fileContent = this.cleanFileContent(fileContent);
      yield {
        type: 'file_complete',
        path: fileSpec.path,
        content: fileContent,
        originalContent: existing?.content,
        size: fileContent.length,
      };
    }

    yield { type: 'task_complete', summary: { filesGenerated: plannedFiles.length, totalFiles: plannedFiles.length } };
  }

  private parsePlan(content: string): ProjectPlan {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
    try {
      const parsed = JSON.parse(jsonMatch.trim());
      return {
        title: parsed.title || 'New Project',
        description: parsed.description || '',
        folders: Array.isArray(parsed.folders) ? parsed.folders.map(String) : [],
        files: Array.isArray(parsed.files)
          ? parsed.files.map((f: Record<string, unknown>) => ({
              path: String(f.path || 'file.txt'),
              description: String(f.description || ''),
              language: f.language ? String(f.language) : undefined,
            }))
          : [],
        commands: Array.isArray(parsed.commands) ? parsed.commands.map(String) : undefined,
      };
    } catch {
      throw new BadRequestException('Failed to parse project plan from AI response');
    }
  }

  private cleanFileContent(content: string): string {
    let cleaned = content.trim();
    const fenceMatch = cleaned.match(/^```[\w]*\n([\s\S]*?)\n```$/);
    if (fenceMatch) cleaned = fenceMatch[1];
    return cleaned;
  }
}
