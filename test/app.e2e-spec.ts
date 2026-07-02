import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/exceptions/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

/**
 * E2E smoke tests.
 * Requires a running PostgreSQL and Redis instance (use docker-compose for CI).
 */
describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/health/liveness', () => {
    it('returns 200 with status: ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/liveness')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('returns 201 and issues tokens', () => {
      const uniqueEmail = `e2e_${Date.now()}@test.com`;
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Test1234!',
          firstName: 'E2E',
          lastName: 'Test',
        })
        .expect(201)
        .expect((res) => {
          // Wrapped by ResponseInterceptor
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
          expect(res.body.data.user.email).toBe(uniqueEmail);
        });
    });

    it('returns 409 when email already registered', async () => {
      const email = `dup_${Date.now()}@test.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'Test1234!', firstName: 'A', lastName: 'B' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'Test1234!', firstName: 'A', lastName: 'B' })
        .expect(409);
    });

    it('returns 400 for a weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `weak_${Date.now()}@test.com`,
          password: 'short',
          firstName: 'A',
          lastName: 'B',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'WrongPass1' })
        .expect(401);
    });
  });

  // ─── Properties (public) ──────────────────────────────────────────────────

  describe('GET /api/v1/properties', () => {
    it('returns 200 with paginated data', () => {
      return request(app.getHttpServer())
        .get('/api/v1/properties')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.meta).toBeDefined();
        });
    });
  });
});
