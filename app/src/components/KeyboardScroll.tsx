import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * التمرير مع لوحة المفاتيح.
 *
 * ═══ لماذا كتبنا هذا بدل KeyboardAvoidingView؟ ═══
 *
 * منذ React Native 0.81 صار وضع edge-to-edge إجباريًا على أندرويد: التطبيق
 * يرسم خلف أشرطة النظام، و`android:windowSoftInputMode="adjustResize"` لم يعد
 * يقلّص النافذة. وكل شاشاتنا كانت تكتب
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — أي **لا شيء**
 * على أندرويد، اعتمادًا على تقليص لم يعد يحدث.
 *
 * ═══ الحلّ من ثلاثة أجزاء، ولا يكفي جزءان ═══
 *
 * ① **مساحة**: حشوة بارتفاع لوحة المفاتيح أسفل المحتوى، فيصير تمرير الحقل
 *    المغطّى إلى الأعلى ممكنًا أصلًا.
 *
 * ② **تمرير عند ظهور اللوحة**: نقيس الحقل المركَّز ونمرّر إليه.
 *
 * ③ **تمرير عند تبديل الحقل** ← هذا ما كان ناقصًا في المحاولة الأولى.
 *    `keyboardDidShow` يقع **مرة واحدة**: عند فتح اللوحة. فمن ضغط «رقم الهاتف»
 *    يُمرَّر إليه، ثم يضغط «كلمة المرور» واللوحة مفتوحة أصلًا — فلا يقع أي
 *    حدث، ولا يتحرّك شيء، ويكتب كلمة مروره خلف اللوحة. ولهذا تصل الحقول
 *    نفسها إلى هنا عبر السياق أدناه وتخبرنا حين تُركَّز.
 *
 * لم نضف مكتبة (`react-native-keyboard-controller`) عمدًا: هي وحدة أصلية،
 * وإضافتها تعني أن أي إصلاح لاحق يحتاج بناءً جديدًا في المتجر بدل تحديث فوري.
 */

/** المسافة المريحة بين أسفل الحقل وأعلى لوحة المفاتيح. */
const BREATHING_ROOM = 40;

/**
 * ارتفاع لوحة المفاتيح الآن — صفر حين تكون مغلقة.
 *
 * نستمع لـ`Will` على iOS و`Did` على أندرويد: iOS يعطي الحدث قبل الحركة
 * فتتزامن الحشوة مع انزلاق اللوحة، وأندرويد لا يرسل `Will` أصلًا.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * قناة بين الحقول ومساحة التمرير التي تحويها.
 *
 * `null` حين لا يوجد `KeyboardScroll` فوق الحقل (داخل نافذة سفلية مثلًا) —
 * فيصمت الحقل بدل أن ينهار.
 */
const KeyboardScrollContext = createContext<{ onFieldFocus: () => void } | null>(null);

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}

type Props = ScrollViewProps & {
  children: React.ReactNode;
  /** حشوة إضافية أسفل المحتوى — لشاشة فيها شريط أزرار ثابت مثلًا. */
  extraBottom?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function KeyboardScroll({
  children,
  extraBottom = 0,
  contentContainerStyle,
  ...rest
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const offset = useRef(0);
  const viewportHeight = useRef(0);
  const keyboard = useKeyboardHeight();
  const insets = useSafeAreaInsets();

  // آخر ارتفاع معروف للوحة — نحتاجه حين يُركَّز حقلٌ واللوحة مفتوحة أصلًا،
  // لأن `keyboard` قد لم يتغيّر فلا يُعاد تشغيل أي تأثير.
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  /**
   * يمرّر إلى الحقل المركَّز إن كان خارج المساحة المرئية.
   *
   * الشرط مهمّ: حقلٌ ظاهر أصلًا لا نلمسه. التمرير غير المشروط كان يقفز بالحقل
   * الأول إلى حافّة اللوحة كلما فُتحت، وهي حركة لا يفهم سببها أحد.
   *
   * ونطرح `insets.bottom` مع ارتفاع اللوحة: على أندرويد الحديث لا يشمل
   * `endCoordinates.height` شريط التنقّل، فالمساحة المحجوبة فعليًا أكبر مما
   * يعلنه النظام — وهذا سبب بقاء الحقل مغطّى جزئيًا رغم التمرير.
   */
  const scrollToFocused = useCallback(
    (keyboardHeight: number) => {
      const focused = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!focused || !content || !keyboardHeight) return;

      focused.measureLayout(
        content,
        (_x: number, y: number, _width: number, height: number) => {
          const occluded = keyboardHeight + insets.bottom + BREATHING_ROOM;
          const visible = viewportHeight.current - occluded;
          const fieldBottom = y + height - offset.current;
          const fieldTop = y - offset.current;

          if (fieldBottom > visible) {
            scrollRef.current?.scrollTo({ y: y + height - visible, animated: true });
          } else if (fieldTop < 0) {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - BREATHING_ROOM), animated: true });
          }
        },
        () => {
          /* اختفى الحقل بين القياس والاستجابة — لا شيء نفعله */
        },
      );
    },
    [insets.bottom],
  );

  // ② اللوحة ظهرت. القياس بعد أن تستقرّ الحشوة الجديدة: قبلها لم يمتدّ
  //    المحتوى بعد، فيخرج الحساب بقيمة تمرير أقصر من اللازم.
  useEffect(() => {
    if (!keyboard) return;
    const timer = setTimeout(() => scrollToFocused(keyboard), 80);
    return () => clearTimeout(timer);
  }, [keyboard, scrollToFocused]);

  // ③ حقلٌ رُكّز. قد تكون اللوحة مفتوحة (تبديل بين حقلين) أو على وشك الفتح
  //    (أول ضغطة) — فننتظر قليلًا ثم نستعمل الارتفاع المتاح وقتها.
  const onFieldFocus = useCallback(() => {
    const attempt = (delay: number) =>
      setTimeout(() => scrollToFocused(keyboardRef.current), delay);
    const first = attempt(120);
    const second = attempt(360);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [scrollToFocused]);

  const channel = React.useMemo(() => ({ onFieldFocus }), [onFieldFocus]);

  return (
    <KeyboardScrollContext.Provider value={channel}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        onLayout={onLayout}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={contentContainerStyle}
        {...rest}
      >
        {/* flexGrow يحفظ تخطيطات الشاشات التي تمدّ محتواها لملء الشاشة */}
        <View
          ref={contentRef}
          style={{ flexGrow: 1, paddingBottom: keyboard + extraBottom }}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardScrollContext.Provider>
  );
}
