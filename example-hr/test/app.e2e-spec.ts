import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ExampleHR Time-Off API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('health check - should return 404 for unknown route', async () => {
    await request(app.getHttpServer())
      .get('/unknown')
      .expect(404);
  });
});