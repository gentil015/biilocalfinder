import { Tabs } from 'expo-router';
import { ClipboardList, LayoutDashboard, MessageCircle, UserRound, Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversations } from '@/src/hooks/queries';
import { getTabScreenOptions } from '@/src/navigation/tabBarOptions';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function ProviderTabsLayout() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const conversations = useConversations();
  const unread = conversations.data?.reduce((total, item) => total + (item.unreadCount ?? 0), 0) ?? 0;

  return (
    <Tabs screenOptions={getTabScreenOptions(colors, bottom)}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tabs.Screen name="services" options={{ title: 'Services', tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} /> }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.white },
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} /> }} />
    </Tabs>
  );
}
