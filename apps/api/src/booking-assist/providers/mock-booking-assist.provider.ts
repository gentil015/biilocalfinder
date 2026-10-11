import { Injectable } from '@nestjs/common';
import {
  BookingAssistInput,
  BookingAssistLanguage,
  BookingAssistOutput,
  BookingAssistProvider,
  DEFAULT_BOOKING_ASSIST_LANGUAGE,
  isBookingAssistLanguage,
} from '../booking-assist.interface';

// Deterministic, keyword-based stand-in used when no GEMINI_API_KEY is
// configured — keeps local dev, CI, and offline sandboxes fully functional,
// same pattern as MockAssistProvider/MockMapProvider/MockPaymentProvider.
// It only ever fills a field whose value literally appears in the client's
// message (date/time/budget keywords, catalog service names, option labels)
// — anything it cannot read straight out of the text is left out so
// BookingAssistService reports it as still missing.
@Injectable()
export class MockBookingAssistProvider implements BookingAssistProvider {
  async suggest(input: BookingAssistInput): Promise<BookingAssistOutput> {
    const latest = input.messages[input.messages.length - 1]?.text ?? '';
    const raw = this.normalize(latest);

    const language = this.detectLanguage(raw) ?? input.language;
    const service = input.serviceLocked ?? this.matchService(raw, input.services);

    const preferredDate = this.extractDate(raw);
    const preferredTime = this.extractTime(raw);
    const { budgetMin, budgetMax } = this.extractBudget(raw);

    const out: BookingAssistOutput = {
      language,
      reply: this.reply(language, !!service),
    };
    if (!input.serviceLocked && service) out.serviceKey = service.key;
    if (latest.trim()) {
      out.title = this.guessTitle(latest);
      out.description = latest.trim().slice(0, 2000);
    }
    if (preferredDate) out.preferredDate = preferredDate;
    if (preferredTime) out.preferredTime = preferredTime;
    if (budgetMin !== undefined) out.budgetMin = budgetMin;
    if (budgetMax !== undefined) out.budgetMax = budgetMax;
    if (input.attributes.length) out.values = this.guessValues(raw, input);

    const questions: string[] = [];
    if (!preferredDate) questions.push(this.ask(language, 'date'));
    if (budgetMin === undefined && budgetMax === undefined) questions.push(this.ask(language, 'budget'));
    if (questions.length) out.questions = questions.slice(0, 3);

    return out;
  }

  // --- language detection -------------------------------------------------

  private detectLanguage(text: string): BookingAssistLanguage | undefined {
    if (RW_MARKERS.some((m) => text.includes(m))) return 'rw';
    if (FR_MARKERS.some((m) => text.includes(m))) return 'fr';
    if (EN_MARKERS.some((m) => text.includes(m))) return 'en';
    return undefined;
  }

  // Lowercased + diacritics stripped so "réparer" matches "reparer" and
  // "demain" survives the accent fold.
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, ' ');
  }

  // --- service matching ---------------------------------------------------

  // Ordered most-specific-first: brake/tire keywords must win over the
  // generic "car" one, plumbing leaks over anything else. A group matches
  // only when its trigger appears in the client's text AND its match
  // appears in a real catalog entry — the mock can never invent a service
  // that is not in `input.services`.
  private matchService(text: string, services: BookingAssistInput['services']) {
    const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
    for (const group of SERVICE_GROUPS) {
      const triggered = group.trigger.some((t) => (t.length <= 3 ? words.has(t) : text.includes(t)));
      if (!triggered) continue;
      const hit = services.find((s) => this.normalize(`${s.name} ${s.category}`).includes(group.match));
      if (hit) return hit;
    }
    return undefined;
  }

  // --- date / time / budget extraction ------------------------------------

  private extractDate(text: string): string | undefined {
    const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)?.[1];
    if (iso && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return iso;

    const now = new Date();
    if (/\btomorrow\b|\bdemain\b|\bejo\b/.test(text)) now.setDate(now.getDate() + 1);
    else if (/\btoday\b|\baujourd hui\b|\buyu munsi\b/.test(text)) {
      // keep today
    } else return undefined;
    return now.toISOString().slice(0, 10);
  }

  private extractTime(text: string): string | undefined {
    const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(text);
    if (ampm) {
      const base = Number(ampm[1]) % 12;
      const hours = ampm[3] === 'pm' ? base + 12 : base;
      return `${String(hours).padStart(2, '0')}:${(ampm[2] ?? '00').padStart(2, '0')}`;
    }
    const h24 = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/.exec(text);
    if (h24) return `${String(Number(h24[1])).padStart(2, '0')}:${h24[2]}`;
    return undefined;
  }

  private extractBudget(text: string): { budgetMin?: number; budgetMax?: number } {
    // Explicit range: "between 30000 and 60000 RWF", "entre X et Y".
    const pair = /\bbetween\b[^0-9]*(\d[\d\s,.]*)[^0-9]*\band\b[^0-9]*(\d[\d\s,.]*)/.exec(text)
      ?? /\bentre\b[^0-9]*(\d[\d\s,.]*)[^0-9]*\bet\b[^0-9]*(\d[\d\s,.]*)/.exec(text);
    if (pair) {
      const a = this.toNumber(pair[1]);
      const b = this.toNumber(pair[2]);
      if (a !== undefined && b !== undefined) return { budgetMin: Math.min(a, b), budgetMax: Math.max(a, b) };
    }

    // Only numbers stated next to a money/budget word count — a bare "2
    // days" or "3 rooms" is never treated as a budget.
    const numbers = new Set<number>();
    for (const re of [MONEY_SUFFIX_RE, BUDGET_CONTEXT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const n = this.toNumber(m[1]);
        if (n !== undefined) numbers.add(n);
      }
    }
    const [first, second] = [...numbers];
    if (first === undefined) return {};
    if (second !== undefined) return { budgetMin: Math.min(first, second), budgetMax: Math.max(first, second) };

    const at = text.search(/\d/);
    const window = at >= 0 ? text.slice(Math.max(0, at - 40), at + 40) : '';
    if (/(at least|au moins|minimum|minimum\b|>=|\bmin\b|kuva)/.test(window)) return { budgetMin: first };
    return { budgetMax: first };
  }

  private toNumber(value: string): number | undefined {
    const cleaned = value.replace(/[\s,]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  // --- category attribute guesses -----------------------------------------

  // Mirrors MockAssistProvider: booleans and option labels can be matched
  // safely against the text; TEXT/NUMBER/PRICE are never guessed.
  private guessValues(text: string, input: BookingAssistInput): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const attr of input.attributes) {
      if (attr.type === 'BOOLEAN') {
        if (text.includes(this.normalize(attr.name))) values[attr.slug] = true;
        continue;
      }
      if ((attr.type === 'SELECT' || attr.type === 'MULTI_SELECT') && attr.options?.length) {
        const hits = attr.options.filter((opt) => text.includes(this.normalize(opt)));
        if (hits.length) values[attr.slug] = attr.type === 'SELECT' ? hits[0] : hits;
      }
    }
    return values;
  }

  // --- copy ---------------------------------------------------------------

  private guessTitle(text: string): string {
    const first = text.split(/[.!?\n]/)[0].trim();
    const title = first || text.trim();
    return title.length <= 90 ? title : `${title.slice(0, 89)}…`;
  }

  private reply(language: string, hasService: boolean): string {
    if (language === 'rw') {
      return hasService
        ? 'Murakoze. Reba ibyerekanywe hasi kandi wahindure niba bikeneye.'
        : 'Ndetse nta gisezero gisobanutse. Nyacura usobanure ikintu ukeneye.';
    }
    if (language === 'fr') {
      return hasService
        ? 'Voici ce que j’ai compris. Vérifiez les champs remplis ci-dessous et corrigez ce qui ne va pas.'
        : 'Je ne suis pas sûr du service dont vous avez besoin. Décrivez-le autrement pour que je puisse continuer.';
    }
    return hasService
      ? "Here's what I understood — review the filled-in fields below and correct anything that's off."
      : "I'm not sure which service you need yet. Please describe it a bit differently so I can continue.";
  }

  private ask(language: string, what: 'date' | 'time' | 'budget'): string {
    const copy: Record<string, Record<string, string>> = {
      en: {
        date: 'What day would you like this done?',
        time: 'What time works for you?',
        budget: 'Do you have a budget in RWF?',
      },
      fr: {
        date: 'Quel jour souhaitez-vous l’intervention ?',
        time: 'À quelle heure ?',
        budget: 'Avez-vous un budget en RWF ?',
      },
      rw: {
        date: 'Ni uwuhe munsi ushaka kugirwa iki gikorwa?',
        time: 'Ni saa zingahe ushaka kugirwaho?',
        budget: 'Ni angahe amafaranga ushaka kugirwaho?',
      },
    };
    const lang = isBookingAssistLanguage(language) ? language : DEFAULT_BOOKING_ASSIST_LANGUAGE;
    return copy[lang][what];
  }
}

const EN_MARKERS = [' i need ', ' i want ', ' please ', ' my ', ' the ', ' can you ', ' looking for '];
const FR_MARKERS = [
  ' je veux',
  ' je voudrais',
  ' besoin',
  ' pourriez',
  ' pouvez',
  ' combien',
  ' demain',
  ' merci',
  ' nettoy',
  ' repar',
  ' une ',
  ' avec ',
  ' pour ',
  ' dans ',
  ' les ',
];
const RW_MARKERS = [
  ' nshaka ',
  ' nkeneye ',
  ' dukeze ',
  ' mfite ',
  ' nifuza ',
  ' umuvugangi ',
  ' gusuka ',
  ' uwuhe munsi ',
  ' saa ',
  ' arimo ',
  ' ukwiye ',
  ' kugirw',
  ' gukorw',
];

// trigger: words that must appear in the (normalized) client message.
// match: substring the winning catalog entry must contain, so only real
// services are ever selected. Ordered specific before generic.
const SERVICE_GROUPS: { trigger: string[]; match: string }[] = [
  { trigger: ['brake', 'frein'], match: 'brake' },
  { trigger: ['tire', 'tyre', 'pneu'], match: 'tire' },
  { trigger: ['battery', 'alternator', 'batterie'], match: 'battery' },
  { trigger: ['leak', 'fuite', 'plumb', 'plomber', 'pipe', 'umuvugangi', 'water tank', 'pump'], match: 'plumb' },
  { trigger: ['electr', 'wiring', 'socket', 'solar'], match: 'electric' },
  { trigger: ['paint', 'peint'], match: 'paint' },
  { trigger: ['carpent', 'furniture', 'cabinet', 'meuble'], match: 'carpent' },
  { trigger: ['clean', 'nettoy', 'gusuka'], match: 'clean' },
  { trigger: ['computer', 'laptop', 'desktop', 'malware', 'virus', 'ordinateur'], match: 'computer' },
  { trigger: ['network', 'wifi', 'router'], match: 'network' },
  { trigger: ['website', 'site web', 'seo'], match: 'website' },
  { trigger: ['software', 'web app', 'develop'], match: 'software' },
  { trigger: ['photograph', 'photo', 'portrait'], match: 'photo' },
  { trigger: ['videograph', 'video'], match: 'video' },
  { trigger: ['decor', 'flower'], match: 'decor' },
  { trigger: ['dj', 'sound system'], match: ' dj' },
  { trigger: ['wedding', 'mariage'], match: 'wedding' },
  { trigger: ['engine', 'vehicle', 'voiture', 'garage', 'diagnostic'], match: 'car repair' },
];

const MONEY_SUFFIX_RE = /(\d[\d\s,.]*)\s*(?:rwf|francs?\b|fr\b)/g;
const BUDGET_CONTEXT_RE = /\b(?:budget|price|prix|amafaranga|mararo)\b[^\d]{0,24}(\d[\d\s,.]*)/g;
