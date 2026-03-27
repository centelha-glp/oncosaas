import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.client.connect().catch((err) => {
      this.logger.warn(
        `Redis unavailable: ${err.message}. Rate limiting will fall back to in-memory.`
      );
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    // 'NX' sets TTL only on first creation, keeping a fixed (not sliding) window
    multi.expire(key, ttlSeconds, 'NX');
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) ?? 1;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  isConnected(): boolean {
    return this.client.status === 'ready';
  }
}
