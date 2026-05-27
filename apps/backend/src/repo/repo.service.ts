import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'release', 'out', '.cache']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.php', '.cs', '.json', '.md', '.sql', '.yaml', '.yml']);

@Injectable()
export class RepoService {
  private readonly logger = new Logger(RepoService.name);
  private openai: OpenAI;
  private qdrant: QdrantClient | null = null;
  private collection = 'xander_code_chunks';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
    const qdrantUrl = this.config.get<string>('QDRANT_URL');
    if (qdrantUrl) {
      this.qdrant = new QdrantClient({ url: qdrantUrl });
    }
  }

  isConfigured(): boolean {
    return !!this.qdrant && !!this.config.get<string>('OPENAI_API_KEY');
  }

  async ensureCollection() {
    if (!this.qdrant) return;
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collection);
    if (!exists) {
      await this.qdrant.createCollection(this.collection, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
    }
  }

  async indexRepository(userId: string, rootPath: string) {
    if (!this.qdrant) {
      return { success: false, message: 'Qdrant not configured. Set QDRANT_URL.' };
    }
    await this.ensureCollection();

    const files = await this.collectFiles(rootPath);
    let indexed = 0;
    const embeddingModel = this.config.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';

    for (const filePath of files.slice(0, 200)) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > 512_000) continue;

        const content = await fs.readFile(filePath, 'utf-8');
        const chunks = this.chunkText(content, 1200);
        const relativePath = path.relative(rootPath, filePath);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await this.openai.embeddings.create({
            model: embeddingModel,
            input: chunk.slice(0, 8000),
          });

          const vector = embedding.data[0].embedding;
          const pointId = `${userId}_${Buffer.from(relativePath + i).toString('base64url').slice(0, 32)}`;

          await this.qdrant.upsert(this.collection, {
            wait: true,
            points: [{
              id: pointId,
              vector,
              payload: {
                userId,
                path: relativePath,
                chunkIndex: i,
                content: chunk.slice(0, 2000),
                rootPath,
              },
            }],
          });
          indexed += 1;
        }
      } catch (err) {
        this.logger.debug(`Skip ${filePath}: ${(err as Error).message}`);
      }
    }

    await this.prisma.usageLog.create({
      data: {
        userId,
        type: 'indexing',
        tokensUsed: 0,
        cost: 0,
        model: embeddingModel,
        metadata: { rootPath, filesScanned: files.length, chunksIndexed: indexed },
      },
    });

    return { success: true, filesScanned: files.length, chunksIndexed: indexed };
  }

  /** Index code chunks uploaded from the desktop client (local filesystem). */
  async indexChunks(
    userId: string,
    rootPath: string,
    chunks: Array<{ path: string; content: string; chunkIndex?: number }>,
  ) {
    if (!this.qdrant) {
      return { success: false, message: 'Qdrant not configured. Set QDRANT_URL.' };
    }
    await this.ensureCollection();

    const embeddingModel = this.config.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';
    let indexed = 0;

    for (const chunk of chunks.slice(0, 500)) {
      try {
        const text = chunk.content.slice(0, 8000);
        if (!text.trim()) continue;

        const embedding = await this.openai.embeddings.create({
          model: embeddingModel,
          input: text,
        });

        const vector = embedding.data[0].embedding;
        const idx = chunk.chunkIndex ?? 0;
        const pointId = `${userId}_${Buffer.from(chunk.path + idx).toString('base64url').slice(0, 32)}`;

        await this.qdrant.upsert(this.collection, {
          wait: true,
          points: [{
            id: pointId,
            vector,
            payload: {
              userId,
              path: chunk.path,
              chunkIndex: idx,
              content: text.slice(0, 2000),
              rootPath,
            },
          }],
        });
        indexed += 1;
      } catch (err) {
        this.logger.debug(`Skip chunk ${chunk.path}: ${(err as Error).message}`);
      }
    }

    return { success: true, chunksIndexed: indexed };
  }

  async searchContext(userId: string, query: string, limit = 8) {
    if (!this.qdrant) return { results: [] };

    const embeddingModel = this.config.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';
    const embedding = await this.openai.embeddings.create({
      model: embeddingModel,
      input: query.slice(0, 8000),
    });

    const results = await this.qdrant.search(this.collection, {
      vector: embedding.data[0].embedding,
      limit,
      filter: { must: [{ key: 'userId', match: { value: userId } }] },
    });

    return {
      results: results.map((r) => ({
        path: r.payload?.path,
        content: r.payload?.content,
        score: r.score,
      })),
    };
  }

  private async collectFiles(dir: string, acc: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await this.collectFiles(full, acc);
      else if (CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) acc.push(full);
    }
    return acc;
  }

  private chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks.length ? chunks : [text];
  }
}
