import React from 'react';
import { ScrollView, View } from 'react-native';

import { api, ApiError } from '../api/client';
import { SubHeader } from '../components/Header';
import { useToast } from '../components/Toast';
import { Avatar, Button, Divider, Empty, Loader, Txt } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';

type BlockedUser = {
  user_id: number;
  name: string;
  initial: string;
  created_at: string;
};

/**
 * المحظورون — الوجه الآخر لزرّ «حظر المعلن».
 *
 * سياسة Google Play لا تكتفي بوجود الحظر: يجب أن يكون **قابلًا للرجوع**
 * ومرئيًا للمستخدم. حظر بلا قائمة يراها صاحبها هو حظر لا يستطيع أحد فكّه.
 */
export function BlockedScreen() {
  const t = useTheme();
  const { t: text } = useI18n();
  const toast = useToast();

  const { data, loading, refresh } = useResource<{ results: BlockedUser[] }>('/auth/blocks');

  const unblock = async (userId: number) => {
    try {
      await api.del(`/auth/blocks/${userId}`);
      toast.show(text.account.unblocked);
      await refresh();
    } catch (caught) {
      toast.show(caught instanceof ApiError ? caught.message : text.errors.generic);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SubHeader title={text.account.blocked} />
      {loading && !data ? (
        <Loader />
      ) : !data || data.results.length === 0 ? (
        <Empty icon="🚫" title={text.account.blockedEmpty} text={text.account.blockedEmptyText} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderWidth: 1,
              borderColor: t.colors.line,
              borderRadius: t.radius.md,
              overflow: 'hidden',
            }}
          >
            {data.results.map((row, index) => (
              <View key={row.user_id}>
                {index > 0 ? <Divider /> : null}
                <View
                  style={[
                    t.row,
                    { alignItems: 'center', gap: 12, padding: t.sp(13) },
                  ]}
                >
                  <Avatar initial={row.initial} size={40} />
                  <Txt size={14.5} weight={700} style={{ flex: 1 }} align="start">
                    {row.name}
                  </Txt>
                  <Button
                    title={text.account.unblock}
                    size="sm"
                    variant="ghost"
                    onPress={() => void unblock(row.user_id)}
                  />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
