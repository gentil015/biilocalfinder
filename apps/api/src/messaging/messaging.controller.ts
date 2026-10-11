import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SocketServerRegistry } from '../realtime/socket-server-registry.service';

// REST fallback for message history and sending — the socket gateway is
// the low-latency path, but nothing here depends on a live connection.
@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagingController {
  constructor(
    private messagingService: MessagingService,
    private registry: SocketServerRegistry,
  ) {}

  // Direct enquiry: opens (or reuses) the client's thread with a provider
  // without posting a service request first.
  @Post('conversations')
  async startConversation(@CurrentUser() user: { id: string }, @Body() dto: StartConversationDto) {
    const result = await this.messagingService.startConversation(user.id, dto);
    if (result.message) {
      this.registry.emitToRoom(
        SocketServerRegistry.conversationRoom(result.id),
        'message:new',
        result.message,
      );
    }
    return result;
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.messagingService.getConversation(id, user.id);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: { id: string }) {
    return this.messagingService.listConversations(user.id);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.messagingService.listMessages(id, user.id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(id, user.id, dto.body);
    this.registry.emitToRoom(SocketServerRegistry.conversationRoom(id), 'message:new', message);
    return message;
  }

  @Patch('conversations/:id/read')
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.messagingService.markRead(id, user.id);
  }
}
