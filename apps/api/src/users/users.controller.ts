import { Body, Controller, Delete, Get, Header, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/locale')
  @ApiOperation({ summary: 'Set the account display language' })
  updateLocale(@CurrentUser() user: { id: string }, @Body() dto: UpdateLocaleDto) {
    return this.usersService.updateLocale(user.id, dto.locale);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  @Header('Content-Disposition', 'attachment; filename="bii-account-export.json"')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Download a portable copy of the account data' })
  exportMe(@CurrentUser() user: { id: string }) {
    return this.usersService.exportMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @ApiOperation({ summary: 'Permanently delete/anonymise the account' })
  deleteMe(@CurrentUser() user: { id: string }, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteMe(user.id, dto.password);
  }
}
