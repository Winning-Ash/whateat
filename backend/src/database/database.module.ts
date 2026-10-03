import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { setServers } from 'node:dns';

@Module({
  imports: [MongooseModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const dnsServers = config.get<string[]>('MONGODB_DNS_SERVERS');
      if (dnsServers?.length) setServers(dnsServers);
      return {
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.getOrThrow<string>('MONGODB_DB_NAME'),
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        retryAttempts: 1,
        // Keep credentials and upstream connection details out of startup errors.
        connectionErrorFactory: () => new Error('MongoDB connection failed. Check URI, credentials and Atlas network access.'),
      };
    },
  })],
})
export class DatabaseModule {}
