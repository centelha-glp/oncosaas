import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from '@/app.module';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';

const logger = new Logger('Bootstrap');

/** Crash loudly in production/staging when required env vars are missing. */
function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isStrict =
    nodeEnv === 'production' || nodeEnv === 'staging';
  if (!isStrict) {
    return;
  }

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'REDIS_URL',
    'FRONTEND_URL',
    'BACKEND_SERVICE_TOKEN',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.join(', ')}`
    );
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  // Verificar se deve usar HTTPS
  const useHttps = process.env.USE_HTTPS === 'true';
  // Certificados estão na raiz do projeto
  // Tentar primeiro na raiz, depois subir um nível (se executado de dentro de backend/)
  let certDir = join(process.cwd(), 'certs');
  if (!existsSync(certDir)) {
    certDir = join(process.cwd(), '..', 'certs');
  }
  const keyPath = join(certDir, 'localhost.key');
  const certPath = join(certDir, 'localhost.crt');

  let httpsOptions = undefined;

  if (useHttps) {
    // Verificar se os certificados existem
    if (!existsSync(keyPath) || !existsSync(certPath)) {
      logger.error('Certificados SSL não encontrados!');
      logger.error(`Esperado em: ${certDir}`);
      logger.error('Execute: npm run generate-certs  ou  USE_HTTPS=false');
      process.exit(1);
    }

    httpsOptions = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    };
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    {
      rawBody: true,
      ...(httpsOptions ? { httpsOptions } : {}),
    }
  );
  app.enableShutdownHooks();

  // [A-01] Configurar trust proxy: 1 nível (nginx/ALB na frente do Node).
  // Garante que request.ip e X-Forwarded-For reflitam o IP real do cliente
  // no ThrottleGuard e AuditLogInterceptor, prevenindo spoofing.
  app.set('trust proxy', 1);

  // [C-04] Security headers HTTP (OWASP / HIPAA best practices).
  // Adiciona X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  // Strict-Transport-Security e Content-Security-Policy padrão.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  app.use(cookieParser());

  // // Criar diretório de uploads se não existir
  // const uploadsDir = join(process.cwd(), 'uploads', 'navigation-steps');
  // if (!existsSync(uploadsDir)) {
  //   mkdirSync(uploadsDir, { recursive: true });
  // }

  // // Servir arquivos estáticos da pasta uploads
  // app.useStaticAssets(join(process.cwd(), 'uploads'), {
  //   prefix: '/uploads',
  // });

  // CORS - origens permitidas configuradas por variável de ambiente
  const frontendUrl =
    process.env.FRONTEND_URL ||
    (useHttps ? 'https://localhost:3000' : 'http://localhost:3000');

  // ALLOWED_ORIGINS suporta múltiplas origens separadas por vírgula (ex: staging + prod)
  const extraOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    'http://frontend:3000',
    'https://frontend:3000',
    // Playwright E2E webServer (default in frontend/playwright.config.ts)
    'http://127.0.0.1:3330',
    'http://localhost:3330',
    frontendUrl,
    ...extraOrigins,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`${origin} blocked by CORS`));
    },
    credentials: true,
  });

  // Global exception filters (order matters: Prisma first, HTTP second)
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Prefixo global para APIs
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3002;
  const protocol = useHttps ? 'https' : 'http';
  await app.listen(port);
  logger.log(`Backend running on ${protocol}://localhost:${port}`);
  if (useHttps) {
    logger.warn(
      'Certifique-se de que o certificado está instalado como confiável!'
    );
  }
}

bootstrap().then(() => {
  logger.log('Bootstrap completed successfully');
}).catch((error) => {
  logger.error('Bootstrap failed', error);
  process.exit(1);
});
