import { MockBookingAssistProvider } from './mock-booking-assist.provider';
import { BookingAssistInput } from '../booking-assist.interface';

const CATALOG = [
  { key: 'plumbing/leak-detection-and-pipe-repair', name: 'Leak detection and pipe repair', category: 'Plumbing' },
  { key: 'cleaning/deep-cleaning-for-homes-and-offices', name: 'Deep cleaning for homes and offices', category: 'Cleaning' },
  { key: 'electrical/wiring-and-socket-installation', name: 'Wiring and socket installation', category: 'Electrical' },
  { key: 'automotive/brake-pad-and-disc-replacement', name: 'Brake pad and disc replacement', category: 'Brake repair' },
];

function makeInput(overrides: Partial<BookingAssistInput> = {}): BookingAssistInput {
  return {
    language: 'en',
    messages: [],
    services: CATALOG,
    attributes: [],
    ...overrides,
  };
}

function ask(text: string, overrides: Partial<BookingAssistInput> = {}) {
  return new MockBookingAssistProvider().suggest(makeInput({ messages: [{ role: 'user', text }], ...overrides }));
}

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('MockBookingAssistProvider (offline fallback)', () => {
  describe('English requests', () => {
    it('extracts service, date, time, and budget from a complete request', async () => {
      const out = await ask(
        'I need a plumber to fix a leaking pipe tomorrow at 10:30am, my budget is 50000 RWF',
      );

      expect(out.language).toBe('en');
      expect(out.serviceKey).toBe('plumbing/leak-detection-and-pipe-repair');
      expect(out.preferredDate).toBe(iso(1));
      expect(out.preferredTime).toBe('10:30');
      expect(out.budgetMax).toBe(50000);
      expect(out.title).toContain('plumber');
      expect(out.reply).toContain('review');
      // No questions: everything asked for was found.
      expect(out.questions).toBeUndefined();
    });

    it('never guesses a date or budget that was not said', async () => {
      const out = await ask('My office needs deep cleaning');

      expect(out.serviceKey).toBe('cleaning/deep-cleaning-for-homes-and-offices');
      expect(out.preferredDate).toBeUndefined();
      expect(out.preferredTime).toBeUndefined();
      expect(out.budgetMin).toBeUndefined();
      expect(out.budgetMax).toBeUndefined();
      expect(out.questions).toEqual([
        'What day would you like this done?',
        'Do you have a budget in RWF?',
      ]);
    });

    it('picks the more specific service over a generic keyword', async () => {
      const out = await ask('My car brakes are squeaking, brake pad replacement needed');
      expect(out.serviceKey).toBe('automotive/brake-pad-and-disc-replacement');
    });
  });

  describe('Kinyarwanda requests', () => {
    it('detects rw, matches the service, and answers in rw', async () => {
      const out = await ask('Nkeneye umuvugangi kuko amazi arimo kuvamo ejo');

      expect(out.language).toBe('rw');
      expect(out.serviceKey).toBe('plumbing/leak-detection-and-pipe-repair');
      expect(out.preferredDate).toBe(iso(1)); // "ejo" = tomorrow
      expect(out.reply).toContain('Murakoze');
      expect(out.questions).toEqual(['Ni angahe amafaranga ushaka kugirwaho?']);
    });

    it('asks what is still missing in Kinyarwanda', async () => {
      const out = await ask('Ndakeneye ko umuvugangi akora amazi');

      expect(out.language).toBe('rw');
      expect(out.questions).toEqual([
        'Ni uwuhe munsi ushaka kugirwa iki gikorwa?',
        'Ni angahe amafaranga ushaka kugirwaho?',
      ]);
    });

    it('detects rw from a short follow-up answer', async () => {
      const out = await ask('ni saa zingahe ukwiye kugirwaho?');
      expect(out.language).toBe('rw');
    });
  });

  describe('French requests', () => {
    it('detects fr, matches the service, and extracts date and budget', async () => {
      const out = await ask(
        'Bonjour, je veux réparer une fuite de plomberie demain, budget de 40000 francs',
      );

      expect(out.language).toBe('fr');
      expect(out.serviceKey).toBe('plumbing/leak-detection-and-pipe-repair');
      expect(out.preferredDate).toBe(iso(1)); // "demain" = tomorrow
      expect(out.budgetMax).toBe(40000);
      expect(out.reply).toContain('compris');
      expect(out.questions).toBeUndefined();
    });

    it('falls back to French copy for what is missing', async () => {
      const out = await ask('Il y a une prise électrique cassée à la maison');

      expect(out.language).toBe('fr');
      expect(out.serviceKey).toBe('electrical/wiring-and-socket-installation');
      expect(out.questions).toEqual([
        'Quel jour souhaitez-vous l’intervention ?',
        'Avez-vous un budget en RWF ?',
      ]);
    });
  });

  describe('safety rules', () => {
    it('never suggests a service outside the given catalog', async () => {
      const out = await ask('I need space travel to the moon');
      expect(out.serviceKey).toBeUndefined();
      expect(out.reply).toContain('not sure which service');
    });

    it('does not replace a service the form has pinned', async () => {
      const out = await ask('actually I also need cleaning', {
        serviceLocked: CATALOG[1],
      });
      expect(out.serviceKey).toBeUndefined();
    });

    it('treats a bare number as a budget only next to a money word', async () => {
      const out = await ask('Deep cleaning, 2 rooms, 60000 RWF please');
      expect(out.budgetMin).toBeUndefined();
      expect(out.budgetMax).toBe(60000);
    });

    it('reads an explicit range as min and max', async () => {
      const out = await ask('cleaning between 30000 and 60000 RWF');
      expect(out.budgetMin).toBe(30000);
      expect(out.budgetMax).toBe(60000);
    });
  });
});
