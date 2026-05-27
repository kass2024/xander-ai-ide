export type StreamEventType =
  | 'step'
  | 'plan'
  | 'folder_start'
  | 'folder_complete'
  | 'file_start'
  | 'file_delta'
  | 'file_complete'
  | 'file_error'
  | 'command_suggested'
  | 'text_delta'
  | 'action'
  | 'error'
  | 'task_complete'
  | 'quota_warning';

export interface StreamEvent {
  type: StreamEventType;
  step?: string;
  message?: string;
  path?: string;
  delta?: string;
  content?: string;
  originalContent?: string;
  size?: number;
  language?: string;
  command?: string;
  requiresApproval?: boolean;
  plan?: {
    title?: string;
    description?: string;
    fileCount?: number;
    folders?: string[];
    files?: Array<{ path: string; description?: string }>;
  };
  summary?: {
    title?: string;
    filesGenerated?: number;
    totalFiles?: number;
    tokens?: number;
    cost?: number;
  };
  action?: {
    type: string;
    path?: string;
    content?: string;
    command?: string;
  };
  quota?: {
    used: number;
    limit: number;
    warning?: boolean;
    warningMessage?: string;
  };
}

export function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
