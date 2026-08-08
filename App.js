import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { C, F } from './src/theme';
import { registerPushToken } from './src/notify';
import { loadGames } from './src/api';
import { isOffline, subscribeOffline } from './src/net';

import GamesScreen from './src/screens/GamesScreen';
import GameDetailScreen from './src/screens/GameDetailScreen';
import BlogScreen from './src/screens/BlogScreen';
import ArticleScreen from './src/screens/ArticleScreen';
import MarketScreen from './src/screens/MarketScreen';
import MarketDetailScreen from './src/screens/MarketDetailScreen';
import ChronoScreen from './src/screens/ChronoScreen';
import MoreScreen from './src/screens/MoreScreen';
import RefScreen from './src/screens/RefScreen';
import RefDetailScreen from './src/screens/RefDetailScreen';
import FaqScreen from './src/screens/FaqScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GuideScreen from './src/screens/GuideScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import AchievementUnlockToast from './src/components/AchievementUnlockToast';
import WelcomeModal from './src/components/WelcomeModal';
import LoginPromptModal from './src/components/LoginPromptModal';
import { recordDay } from './src/achievements';
import { loadFavs } from './src/favorites';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: C.oliveLt,
    background: C.bg,
    card: C.bg2,
    text: C.sand,
    border: C.border,
    notification: C.olive,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: C.bg2 },
  headerTintColor: C.sand,
  headerTitleStyle: { fontFamily: F.title, fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 },
  contentStyle: { backgroundColor: C.bg },
};

const GamesStack = createNativeStackNavigator();
function GamesNav() {
  return (
    <GamesStack.Navigator screenOptions={screenOptions}>
      <GamesStack.Screen name="Games" component={GamesScreen} options={{ title: 'Игры' }} />
      <GamesStack.Screen name="GameDetail" component={GameDetailScreen} options={{ title: 'Игра' }} />
    </GamesStack.Navigator>
  );
}

const BlogStack = createNativeStackNavigator();
function BlogNav() {
  return (
    <BlogStack.Navigator screenOptions={screenOptions}>
      <BlogStack.Screen name="Blog" component={BlogScreen} options={{ title: 'Блог' }} />
      <BlogStack.Screen name="Article" component={ArticleScreen} options={{ title: 'Статья' }} />
    </BlogStack.Navigator>
  );
}

const MarketStack = createNativeStackNavigator();
function MarketNav() {
  return (
    <MarketStack.Navigator screenOptions={screenOptions}>
      <MarketStack.Screen name="Market" component={MarketScreen} options={{ title: 'Барахолка' }} />
      <MarketStack.Screen name="MarketDetail" component={MarketDetailScreen} options={{ title: 'Объявление' }} />
    </MarketStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator();
function MoreNav() {
  return (
    <MoreStack.Navigator screenOptions={screenOptions} initialRouteName="More">
      <MoreStack.Screen name="More" component={MoreScreen} options={{ title: 'Ещё' }} />
      <MoreStack.Screen name="Ref" component={RefScreen} options={({ route }) => ({ title: route.params?.title || 'Справочник' })} />
      <MoreStack.Screen name="RefDetail" component={RefDetailScreen} options={({ route }) => ({ title: route.params?.title || 'Карточка' })} />
      <MoreStack.Screen name="Faq" component={FaqScreen} options={{ title: 'Вопросы и правила' }} />
      <MoreStack.Screen name="Chrono" component={ChronoScreen} options={{ title: 'Хронограф' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Военный билет' }} />
      <MoreStack.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Достижения' }} />
      <MoreStack.Screen name="Guide" component={GuideScreen} options={{ title: 'Новичку' }} />
      <MoreStack.Screen name="Checklist" component={ChecklistScreen} options={{ title: 'Чек-лист снаряжения' }} />
    </MoreStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();
const ICONS = { Игры: 'calendar', Блог: 'newspaper', Барахолка: 'pricetags', Ещё: 'grid' };

const navRef = createNavigationContainerRef();

// Ненавязчивый индикатор офлайна (абсолютный оверлей — не сдвигает верстку).
function OfflineBanner() {
  const [off, setOff] = useState(isOffline());
  useEffect(() => subscribeOffline(setOff), []);
  if (!off) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 70, left: 0, right: 0, alignItems: 'center', zIndex: 999 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Ionicons name="cloud-offline" size={13} color={C.textDim} />
        <Text style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>Офлайн · сохранённые данные</Text>
      </View>
    </View>
  );
}

// Открыть игру по тапу на пуш «Новая игра»
async function openGameFromNotification(response) {
  try {
    const data = response?.notification?.request?.content?.data || {};
    if (!navRef.isReady()) return;
    if (data.screen === 'checklist') { navRef.navigate('Ещё', { screen: 'Checklist' }); return; }
    if (data.marketId) { navRef.navigate('Барахолка'); return; }
    if (data.blogId) { navRef.navigate('Блог'); return; }
    if (data.gameId) {
      const games = await loadGames();
      const game = games.find(g => g.id === data.gameId);
      if (game) navRef.navigate('Игры', { screen: 'GameDetail', params: { game } });
    }
  } catch (e) {}
}

export default function App() {
  const responded = useRef(false);
  const [fontsLoaded] = useFonts({
    Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold, ShareTechMono_400Regular,
  });

  useEffect(() => {
    registerPushToken();
    recordDay(); // отметка «заходил сегодня» для ачивки «Старожил»
    loadFavs();  // подтягиваем избранное барахолки
    // Приложение открыли тапом по пушу из выгруженного состояния
    Notifications.getLastNotificationResponseAsync().then(resp => {
      if (resp && !responded.current) { responded.current = true; openGameFromNotification(resp); }
    });
    // Тап по пушу при работающем приложении
    const sub = Notifications.addNotificationResponseReceivedListener(openGameFromNotification);
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null; // держим сплэш, пока грузятся шрифты

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navRef}>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: C.oliveLt,
            tabBarInactiveTintColor: C.textDim,
            tabBarStyle: { backgroundColor: C.bg2, borderTopColor: C.border },
            tabBarLabelStyle: { fontFamily: F.med, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
            tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name] || 'ellipse'} size={size} color={color} />,
          })}
        >
          <Tab.Screen name="Игры" component={GamesNav} />
          <Tab.Screen name="Блог" component={BlogNav} />
          <Tab.Screen name="Барахолка" component={MarketNav} />
          <Tab.Screen name="Ещё" component={MoreNav} />
        </Tab.Navigator>
      </NavigationContainer>
      <OfflineBanner />
      <AchievementUnlockToast />
      <WelcomeModal onOpenGuide={() => { if (navRef.isReady()) navRef.navigate('Ещё', { screen: 'Guide' }); }} />
      <LoginPromptModal />
    </SafeAreaProvider>
  );
}
