import { Image } from 'expo-image';
import { CalendarClock, ChevronDown, Clock, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/States';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { OfferingItem } from '@/src/types/api';
import { formatMoney, humanize } from '@/src/utils/format';

const PRICE_LABEL: Record<string, string> = {
  FIXED: 'Fixed price',
  HOURLY: 'Per hour',
  PER_DAY: 'Per day',
  STARTING_FROM: 'Starting from',
  CUSTOM_QUOTE: 'Custom quote',
};

function attrEntries(value: OfferingItem['attributeValues']): Array<{ key: string; label: string; value: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        const e = entry as Record<string, unknown>;
        const ca = e.categoryAttribute as { name?: string; label?: string } | undefined;
        const label = humanize(String(ca?.label ?? ca?.name ?? e.label ?? e.name ?? ''));
        const raw = e.textValue ?? e.numberValue ?? e.booleanValue ?? e.jsonValue ?? e.value;
        if (!label) return null;
        if (raw === null || raw === undefined || raw === false) return null;
        const val = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'boolean' ? 'Yes' : String(raw);
        return { key: `${index}`, label, value: val };
      })
      .filter(Boolean) as Array<{ key: string; label: string; value: string }>;
  }
  return Object.entries(value)
    .filter(([, raw]) => raw !== null && raw !== undefined && raw !== false)
    .map(([key, raw]) => ({
      key,
      label: humanize(key),
      value: Array.isArray(raw) ? raw.join(', ') : typeof raw === 'boolean' ? 'Yes' : String(raw),
    }));
}

export function ProviderServicesCatalogue({
  providerId: _providerId,
  offerings,
  selectedId,
  onSelect,
  onBook,
}: {
  providerId: string;
  offerings: OfferingItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBook: (offering: OfferingItem) => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offerings;
    return offerings.filter((o) => {
      const attrs = attrEntries(o.attributeValues).map((a) => `${a.label} ${a.value}`).join(' ');
      return [o.title, o.service?.name, o.service?.category?.name, o.description, o.duration, o.availabilityNote, attrs]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [offerings, query]);

  return (
    <View>
      <SectionHeader
        title="Services offered"
        subtitle={offerings.length ? `${offerings.length} service${offerings.length === 1 ? '' : 's'} available` : undefined}
      />

      {offerings.length > 4 ? (
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search services..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filtered.length ? (
        <View style={{ gap: spacing.sm }}>
          {filtered.map((offering) => {
            const selected = selectedId === offering.id;
            const expanded = expandedId === offering.id;
            const attrs = attrEntries(offering.attributeValues);
            const visibleAttrs = expanded ? attrs : attrs.slice(0, 3);
            const image = offering.images?.[0]?.url;
            const name = offering.title ?? offering.service?.name ?? 'Service';
            const priceText =
              offering.priceType === 'CUSTOM_QUOTE' || offering.basePrice == null
                ? 'Request a quote'
                : formatMoney(offering.basePrice, offering.currency ?? undefined);

            return (
              <Card
                key={offering.id}
                onPress={() => onSelect(offering.id)}
                style={selected ? { borderColor: colors.primary } : undefined}
              >
                <View style={styles.cardTop}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.surfaceMuted ?? colors.border }]}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Service</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.row}>
                      <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={2}>{name}</Text>
                      {selected ? <Badge label="Selected" tone="accent" /> : null}
                    </View>
                    {offering.service?.category?.name ? (
                      <Text style={[typography.caption, { color: colors.primary }]}>{offering.service.category.name}</Text>
                    ) : null}
                    <Text style={[typography.bodyStrong, { color: colors.primaryDark }]}>{priceText}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {PRICE_LABEL[offering.priceType ?? 'FIXED'] ?? humanize(offering.priceType ?? 'Fixed')}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  {offering.duration != null ? (
                    <View style={styles.metaItem}><Clock size={13} color={colors.textMuted} /><Text style={[typography.caption, { color: colors.textMuted }]}>{String(offering.duration)}</Text></View>
                  ) : null}
                  {offering.availabilityNote ? (
                    <View style={styles.metaItem}><CalendarClock size={13} color={colors.textMuted} /><Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{offering.availabilityNote}</Text></View>
                  ) : null}
                </View>

                {offering.description ? (
                  <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 2}>
                    {offering.description}
                  </Text>
                ) : null}

                {visibleAttrs.length ? (
                  <View style={styles.attrs}>
                    {visibleAttrs.map((a) => (
                      <View key={a.key} style={[styles.attrChip, { backgroundColor: colors.surfaceMuted ?? colors.border }]}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                          {a.label}: {a.value}
                        </Text>
                      </View>
                    ))}
                    {!expanded && attrs.length > 3 ? (
                      <Text style={[typography.caption, { color: colors.textMuted }]}>+{attrs.length - 3} more</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Pressable onPress={() => setExpandedId(expanded ? null : offering.id)} style={styles.detailsBtn} hitSlop={8}>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>{expanded ? 'Show less' : 'View details'}</Text>
                    <ChevronDown size={14} color={colors.primary} style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined} />
                  </Pressable>
                  <Button label="Book service" size="sm" onPress={() => onBook(offering)} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title={query ? 'No matching services' : 'No offerings listed'}
          message={query ? 'Try another search term.' : 'Contact this provider to discuss your service.'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 42, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  image: { width: 76, height: 76, borderRadius: radius.sm },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  attrChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, maxWidth: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
});
