import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InteractionService } from './interaction.service';
import { RecordInteractionDto } from '../dto/record-interaction.dto';

// Most interactions are recorded automatically from inside the business
// modules that already handle the corresponding action (favorites,
// bookings, quotes, etc. — see PersonalizationModule's consumers). This
// endpoint exists only for pure frontend navigation events with no
// natural backend hook — a service or category detail view.
@ApiTags('personalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personalization/interactions')
export class InteractionController {
  constructor(private interactionService: InteractionService) {}

  @Post()
  record(@CurrentUser() user: { id: string }, @Body() dto: RecordInteractionDto) {
    return this.interactionService.record(user.id, dto.type, dto.entityType, dto.entityId, dto.metadata);
  }
}
