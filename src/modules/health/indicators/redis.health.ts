import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      connectTimeout: 5_000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      await redis.disconnect();

      if (pong !== 'PONG') {
        throw new Error('Unexpected Redis response');
      }

      return this.getStatus(key, true, { status: 'connected' });
    } catch (error) {
      try {
        await redis.disconnect();
      } catch (_) {
        // ignore cleanup errors
      }
      const result = this.getStatus(key, false, { error: error.message });
      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}
