import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
  useFonts,
} from '@expo-google-fonts/cairo';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from './src/components/Toast';
import { UpdateGate } from './src/components/UpdateGate';
import { I18nProvider } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppConfigProvider } from './src/state/AppConfigContext';
import { AuthProvider } from './src/state/AuthContext';
import { FavoritesProvider } from './src/state/FavoritesContext';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { LIGHT } from './src/theme/tokens';

/**
 * سوق الرقة — نقطة الدخول.
 *
 * ترتيب المزوّدات مقصود:
 *   AppConfig (التصميم والعملة والمزايا)
 *     → I18n (اللغة والاتجاه)
 *       → Theme (يحتاج الاثنين معًا)
 *         → Auth → Favorites (تحتاج معرفة المستخدم)
 */
/** بعد هذه المدة نُقلع بخط النظام بدل انتظار Cairo إلى ما لا نهاية. */
const FONT_TIMEOUT_MS = 2500;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
  });

  // شاشة خضراء لا تنتهي هي أسوأ من خطّ غير مثالي — خصوصًا على أجهزة ضعيفة
  const [waitedEnough, setWaitedEnough] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setWaitedEnough(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || Boolean(fontError) || waitedEnough;

  return (
    <SafeAreaProvider>
      <AppConfigProvider>
        <I18nProvider>
          <ThemeProvider fontsReady={fontsLoaded}>
            <AuthProvider>
              <FavoritesProvider>
                <ToastProvider>
                  {ready ? (
                    <UpdateGate>
                      <ThemedStatusBar />
                      <RootNavigator />
                    </UpdateGate>
                  ) : (
                    <SplashScreen />
                  )}
                </ToastProvider>
              </FavoritesProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </AppConfigProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  // الترويسة دائمًا بلون العلامة الداكن، فالأيقونات بيضاء في الوضعين
  return <StatusBar style="light" />;
}

/** شاشة الإقلاع — بلون العلامة حتى لا يومض الأبيض قبل تحميل الخطوط. */
function SplashScreen() {
  return <View style={{ flex: 1, backgroundColor: LIGHT.brand }} />;
}
