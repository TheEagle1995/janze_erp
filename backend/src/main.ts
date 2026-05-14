import 'reflect-metadata'
import { NestFactory }    from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule }      from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { JwtAuthGuard }   from './common/guards/jwt-auth.guard'
import { RolesGuard }     from './common/guards/roles.guard'
import { Reflector }      from '@nestjs/core'
import helmet      from 'helmet'
import * as compression from 'compression'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Security
  app.use(helmet())
  app.use(compression())
  // Production frontend + localhost are always allowed; CORS_ORIGINS env can extend this list
  const productionOrigins = [
    'https://janze-erp-frontend.vercel.app',
    'https://janze-erp-frontend-nuriddinovabrorbek321-4949s-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ]
  const extraOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? []
  const allowedOrigins = [...new Set([...productionOrigins, ...extraOrigins])]
  app.enableCors({ origin: allowedOrigins, credentials: true })

  // Global prefix
  app.setGlobalPrefix('api/v1')

  // Global guards
  const reflector = app.get(Reflector)
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  )

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter())

  // Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: false,
    transform:            true,
    transformOptions:     { enableImplicitConversion: true },
  }))

  // Swagger (development only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AVERO & Janze ERP API')
      .setDescription('Complete Retail ERP REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))
  }

  // Health endpoint (no /api/v1 prefix)
  const httpAdapter = app.getHttpAdapter()
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
  })

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`🚀 API running on http://localhost:${port}/api/v1`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger: http://localhost:${port}/docs`)
  }
}

process.on('unhandledRejection', (r) => console.error('Unhandled rejection:', r))
bootstrap().catch(err => { console.error('Bootstrap failed:', err); process.exit(1) })
