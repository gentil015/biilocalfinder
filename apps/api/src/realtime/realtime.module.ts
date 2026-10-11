import { Global, Module } from '@nestjs/common';
import { SocketServerRegistry } from './socket-server-registry.service';

@Global()
@Module({
  providers: [SocketServerRegistry],
  exports: [SocketServerRegistry],
})
export class RealtimeModule {}
