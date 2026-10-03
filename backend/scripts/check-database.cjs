require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/mongoose');
const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { validateEnv } = require('../dist/config/env.validation');
const { DatabaseModule } = require('../dist/database/database.module');
class DatabaseCheckModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), DatabaseModule] })(DatabaseCheckModule);

(async () => {
  let app;
  try {
    app = await NestFactory.createApplicationContext(DatabaseCheckModule, { logger: false, abortOnError: false });
    const connection = app.get(getConnectionToken());
    await connection.db.command({ ping: 1 });
    console.log('MongoDB connection and ping succeeded. No data was written.');
  } catch {
    console.error('MongoDB connection check failed. Check environment settings, database credentials and Atlas network access.');
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
