import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * التمرير مع لوحة المفاتيح.
 *
 * ═══ لماذا كتبنا هذا بدل KeyboardAvoidingView؟ ═══
 *
 * منذ React Native 0.81 صار وضع edge-to-edge إجباريًا على أندرويد: التطبيق
 * يرسم خلف أشرطة النظام، و`android:windowSoftInputMode="adjustResize"` لم يعد
 * يقلّص النافذة. وكل شاشاتنا كانت تكتب:
 *
 *     behavior={Platform.OS === 'ios' ? 'padding' : undefined}
 *
 * أي **لا شيء على أندرويد** — اعتمادًا على تقليص النافذة الذي لم يعد يحدث.
 * فصارت لوحة المفاتيح تغطّي الحقل الذي يكتب فيه المستخدم، ولا سبيل للتمرير
 * إليه لأن المحتوى لا يمتدّ تحتها أصلًا.
 *
 * ═══ الحلّ هنا، وهو من جزأين لا يكفي أحدهما ═══
 *
 * ① **مساحة**: نضيف ارتفاع لوحة المفاتيح حشوًا أسفل المحتوى، فيصير بالإمكان
 *    تمرير الحقل المغطّى إلى الأعلى.
 * ② **تمرير تلقائي**: نقيس موضع الحقل المركَّز داخل المحتوى، وإن كان خلف
 *    اللوحة نمرّر إليه بأنفسنا. بلا هذا يبقى على المستخدم أن يمرّر يدويًا
 *    وهو لا يرى ما يكتب — وهذا نصف حلّ.
 *
 * لم نضف مكتبة (`react-native-keyboard-controller`) عمدًا: هي وحدة أصلية،
 * وإضافتها تعني أن أي إصلاح لاحق لهذه المشكلة يحتاج بناءً جديدًا في المتجر
 * بدل تحديث فوري عن بُعد.
 */

/** المسافة المريحة بين أسفل الحقل وأعلى لوحة المفاتيح. */
const BREATHING_ROOM = 24;

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

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  /**
   * يمرّر إلى الحقل المركَّز إن كان خارج المساحة المرئية.
   *
   * الشرط مهمّ: حقلٌ ظاهر أصلًا لا نلمسه. التمرير غير المشروط كان يقفز
   * بالحقل الأول إلى حافّة اللوحة كلما فُتحت، وهي حركة لا يفهم سببها أحد.
   */
  const scrollToFocused = useCallback((keyboardHeight: number) => {
    const focused = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!focused || !content || !keyboardHeight) return;

    focused.measureLayout(
      content,
      (_x: number, y: number, _width: number, height: number) => {
        const visible = viewportHeight.current - keyboardHeight - BREATHING_ROOM;
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
  }, []);

  // القياس بعد أن تستقرّ الحشوة الجديدة: قبلها المحتوى لم يمتدّ بعد،
  // فيخرج الحساب بقيمة تمرير أقصر من اللازم.
  useEffect(() => {
    if (!keyboard) return;
    const timer = setTimeout(() => scrollToFocused(keyboard), 60);
    return () => clearTimeout(timer);
  }, [keyboard, scrollToFocused]);

  return (
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
      <View ref={contentRef} style={{ flexGrow: 1, paddingBottom: keyboard + extraBottom }}>
        {children}
      </View>
    </ScrollView>
  );
}
