import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { HttpAdapterHost } from '@nestjs/core';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
class SmokeTestModule {}

describe('E2E Smoke', () => {
  let app: INestApplication;

  beforeAll(async (): Promise<void> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SmokeTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('boots Nest app and HTTP adapter', (): void => {
    const adapterHost = app.get(HttpAdapterHost);
    expect(adapterHost.httpAdapter).toBeDefined();
    expect(app.getHttpServer()).toBeDefined();
  });
});
