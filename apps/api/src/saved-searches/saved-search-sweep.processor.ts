import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from './saved-searches.service';

export const SAVED_SEARCH_QUEUE = 'saved-search-sweep';

// Runs daily (registered in SavedSearchesModule). One notification per
// saved search that has new matches — not one per matching provider, so a
// search that suddenly matches 8 new providers is one nudge, not 8.
@Processor(SAVED_SEARCH_QUEUE)
export class SavedSearchSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(SavedSearchSweepProcessor.name);

  constructor(
    private prisma: PrismaService,
    private savedSearches: SavedSearchesService,
    private notifications: NotificationsService,
  ) {
    super();
  }

  async process() {
    const searches = await this.prisma.savedSearch.findMany({ where: { isActive: true } });

    let notified = 0;
    for (const search of searches) {
      const matches = await this.savedSearches.findNewMatches(search);
      const now = new Date();
      // Always advance the checkpoint, matches or not, so a quiet search
      // doesn't re-scan its entire history forever.
      await this.prisma.savedSearch.update({ where: { id: search.id }, data: { lastNotifiedAt: now } });
      if (matches.length === 0) continue;

      notified++;
      const names = matches.slice(0, 3).map((m) => m.businessName).join(', ');
      const extra = matches.length > 3 ? ` and ${matches.length - 3} more` : '';
      await this.notifications.notify({
        userId: search.userId,
        type: 'NEW_PROVIDER_MATCH',
        title: `New matches for "${search.name}"`,
        body: `${names}${extra} — new since you saved this search.`,
        data: { savedSearchId: search.id, providerIds: matches.map((m) => m.id) },
      });
    }

    this.logger.log(`Saved search sweep: ${notified}/${searches.length} search(es) had new matches`);
    return { notified, total: searches.length };
  }
}
