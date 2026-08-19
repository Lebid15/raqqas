import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { ApiError, api } from '../api/client';
import { deletePhoto, uploadPhotos, type PickedPhoto } from '../api/photos';
import type { Category, City, Listing, Media } from '../api/types';
import { ChoiceGroup, Field, Input, SelectButton, TextArea } from '../components/Field';
import { SubHeader } from '../components/Header';
import { OptionList, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { Button, Empty, Loader, Notice, Txt } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListing'>;

/** الحالات التي ترفض الخلفية تعديلها — نمنعها هنا بدل انتظار خطأ من الخادم. */
const LOCKED_STATUSES = ['suspended', 'deleted'];

export function EditListingScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const { config } = useAppConfig();
  const toast = useToast();

  const listingId = route.params.id;
  const { data: listing, loading } = useResource<Listing>(`/listings/${listingId}`);
  const { data: categories } = useResource<Category[]>('/categories', { cacheKey: 'categories' });
  const { data: cities } = useResource<City[]>('/cities', { cacheKey: 'cities' });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('used');
  const [parentId, setParentId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [address, setAddress] = useState('');

  const [existing, setExisting] = useState<Media[]>([]);
  const [added, setAdded] = useState<PickedPhoto[]>([]);

  const [sheet, setSheet] = useState<'parent' | 'child' | 'city' | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [ready, setReady] = useState(false);

  /* ------------------------------------------------------- تعبئة النموذج مرة واحدة */

  useEffect(() => {
    if (!listing || ready) return;
    setTitle(listing.title);
    setDescription(listing.description);
    setPrice(listing.price === null ? '' : String(listing.price));
    setCondition(listing.condition);
    setParentId(listing.category?.parent?.id ?? listing.category?.id ?? null);
    setCategoryId(listing.category?.id ?? null);
    setCityId(listing.city?.id ?? null);
    setAddress(listing.address ?? '');
    setExisting(listing.media ?? []);
    setReady(true);
  }, [listing, ready]);

  const parent = categories?.find((c) => c.id === parentId) ?? null;
  const child = parent?.children?.find((c) => c.id === categoryId) ?? null;
  const city = useMemo(() => cities?.find((c) => c.id === cityId) ?? null, [cities, cityId]);
  const maxPhotos = config.limits.max_photos_per_listing;
  const photoCount = existing.length + added.length;

  /* ---------------------------------------------------------------- الصور */

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show(text.errors.permissionPhotos);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos - photoCount,
      quality: 0.75,
    });
    if (result.canceled) return;

    const picked: PickedPhoto[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));
    setAdded((current) => [...current, ...picked].slice(0, maxPhotos - existing.length));
  };

  /**
   * حذف صورة مرفوعة — يحدث فورًا على الخادم لا عند الحفظ.
   *
   * السبب: الحذف لا رجعة فيه، وتأجيله إلى «حفظ» يجعل المستخدم يظنّ أن بإمكانه
   * التراجع بالخروج من الشاشة. نقولها له صراحة في نصّ التأكيد.
   */
  const removeExisting = (media: Media) => {
    Alert.alert(text.edit.deletePhoto, text.edit.deletePhotoText, [
      { text: text.common.cancel, style: 'cancel' },
      {
        text: text.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhoto(listingId, media.id);
            setExisting((current) => current.filter((item) => item.id !== media.id));
            toast.show(text.edit.photoDeleted);
          } catch (caught) {
            toast.show(caught instanceof ApiError ? caught.message : text.errors.generic);
          }
        },
      },
    ]);
  };

  const removeAdded = (index: number) =>
    setAdded((current) => current.filter((_, i) => i !== index));

  /* ---------------------------------------------------------------- الحفظ */

  const canSave =
    ready &&
    title.trim().length >= 5 &&
    description.trim().length >= config.limits.min_description_length &&
    categoryId !== null &&
    cityId !== null &&
    photoCount > 0;

  const save = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.patch<Listing>(`/listings/${listingId}`, {
        title: title.trim(),
        description: description.trim(),
        price: price.trim() === '' ? null : Number(price.replace(/\D/g, '')),
        condition,
        category: categoryId,
        city: cityId,
        address: address.trim(),
      });

      if (added.length) {
        setProgress({ done: 0, total: added.length });
        const outcome = await uploadPhotos(listingId, added, (done, total) =>
          setProgress({ done, total }),
        );
        setAdded(outcome.failed);
        setExisting((current) => [...current, ...outcome.uploaded]);
        if (outcome.failed.length) {
          // التعديلات النصّية حُفظت فعلًا — نقولها بدل إيهامه بفشل كامل
          toast.show(outcome.message ?? text.errors.generic);
          return;
        }
      }

      toast.show(text.edit.saved);
      navigation.goBack();
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught);
      else toast.show(text.errors.generic);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  /* ---------------------------------------------------------------- الحالات الخاصة */

  if (loading && !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <SubHeader title={text.edit.title} onBack={() => navigation.goBack()} />
        <Loader />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <SubHeader title={text.edit.title} onBack={() => navigation.goBack()} />
        <Empty icon="🔍" title={text.edit.notFound} />
      </View>
    );
  }

  if (!listing.can_edit || LOCKED_STATUSES.includes(listing.status)) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <SubHeader title={text.edit.title} onBack={() => navigation.goBack()} />
        <Empty icon="🔒" title={text.edit.notEditable} />
      </View>
    );
  }

  /* ---------------------------------------------------------------- النموذج */

  const thumbBox = {
    width: 76,
    height: 76,
    borderRadius: t.radius.sm,
    overflow: 'hidden' as const,
    backgroundColor: t.colors.surface2,
  };

  const removeButton = {
    position: 'absolute' as const,
    top: 3,
    [t.isRTL ? 'left' : 'right']: 3,
    width: 22,
    height: 22,
    borderRadius: t.radius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SubHeader title={text.edit.title} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && !error.fields ? (
          <View style={{ marginBottom: 16 }}>
            <Notice tone="danger">{error.message}</Notice>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <Notice tone="warn">{text.edit.reviewNotice}</Notice>
        </View>

        {/* الصور */}
        <Field
          label={`📸 ${text.add.photos}`}
          required
          hint={tp(text.add.photosHint, { max: maxPhotos })}
        >
          <View style={[t.row, { flexWrap: 'wrap', gap: 8 }]}>
            {existing.map((media, index) => (
              <View key={media.id} style={thumbBox}>
                <Image
                  source={{ uri: media.thumb_url || media.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                <Pressable onPress={() => removeExisting(media)} hitSlop={6} style={removeButton}>
                  <Txt size={12} color="#FFFFFF">
                    ✕
                  </Txt>
                </Pressable>
                {index === 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: t.colors.brand,
                      paddingVertical: 2,
                    }}
                  >
                    <Txt size={9.5} weight={800} color={t.colors.onBrand} align="center">
                      {text.add.mainPhoto}
                    </Txt>
                  </View>
                ) : null}
              </View>
            ))}

            {added.map((photo, index) => (
              <View
                key={`${photo.uri}-${index}`}
                style={[thumbBox, { borderWidth: 1.5, borderColor: t.colors.gold }]}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                <Pressable onPress={() => removeAdded(index)} hitSlop={6} style={removeButton}>
                  <Txt size={12} color="#FFFFFF">
                    ✕
                  </Txt>
                </Pressable>
              </View>
            ))}

            {photoCount < maxPhotos ? (
              <Pressable
                onPress={pickPhotos}
                style={({ pressed }) => ({
                  width: 76,
                  height: 76,
                  borderRadius: t.radius.sm,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: t.colors.brand100,
                  backgroundColor: t.colors.brand50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Txt size={20} color={t.colors.brandText}>
                  ＋
                </Txt>
                <Txt size={10} weight={700} color={t.colors.brandText}>
                  {text.add.addPhoto}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </Field>

        <Field
          label={text.add.listingTitle}
          required
          hint={text.add.listingTitleHint}
          error={error?.fieldError('title')}
        >
          <Input value={title} onChangeText={setTitle} maxLength={120} />
        </Field>

        <Field label={text.add.category} required error={error?.fieldError('category')}>
          <View style={{ gap: 8 }}>
            <SelectButton
              value={parent?.name}
              placeholder={text.add.chooseCategory}
              icon={parent?.icon}
              onPress={() => setSheet('parent')}
            />
            {parent?.children?.length ? (
              <SelectButton
                value={child?.name}
                placeholder={text.add.chooseSubcategory}
                onPress={() => setSheet('child')}
              />
            ) : null}
          </View>
        </Field>

        <Field label={text.add.city} required error={error?.fieldError('city')}>
          <SelectButton
            value={city?.name}
            placeholder={text.add.chooseCity}
            icon="🏙"
            onPress={() => setSheet('city')}
          />
        </Field>

        <Field
          label={text.add.address}
          hint={text.add.addressHint}
          error={error?.fieldError('address')}
        >
          <Input
            value={address}
            onChangeText={setAddress}
            placeholder={text.add.addressPlaceholder}
            maxLength={200}
          />
        </Field>

        <Field
          label={`${text.add.price} (${config.currency.symbol})`}
          hint={text.add.priceHint}
          error={error?.fieldError('price')}
        >
          <Input
            value={price}
            onChangeText={(value) => setPrice(value.replace(/[^\d]/g, ''))}
            placeholder="0"
            keyboardType="number-pad"
            ltr
          />
        </Field>

        <Field label={text.add.condition} required>
          <ChoiceGroup
            value={condition}
            onChange={setCondition}
            options={[
              { value: 'new', label: text.listing.conditionNew, icon: '✨' },
              { value: 'used', label: text.listing.conditionUsed, icon: '📦' },
            ]}
          />
        </Field>

        <Field
          label={text.add.description}
          required
          hint={text.add.descriptionHint}
          error={error?.fieldError('description')}
        >
          <TextArea value={description} onChangeText={setDescription} maxLength={4000} />
        </Field>

        <Button
          title={
            progress
              ? tp(text.add.uploadingPhotos, { done: progress.done, total: progress.total })
              : busy
                ? text.edit.saving
                : text.edit.save
          }
          size="lg"
          block
          loading={busy}
          disabled={!canSave}
          onPress={save}
        />
      </ScrollView>

      <Sheet visible={sheet === 'parent'} title={text.add.chooseCategory} onClose={() => setSheet(null)}>
        <OptionList
          options={(categories ?? []).map((category) => ({
            value: category.id,
            label: `${category.icon || '📦'}  ${category.name}`,
          }))}
          value={parentId}
          onChange={(value) => {
            setParentId(value);
            const next = categories?.find((c) => c.id === value);
            setCategoryId(next?.children?.length ? null : value);
            setSheet(next?.children?.length ? 'child' : null);
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'child'} title={text.add.chooseSubcategory} onClose={() => setSheet(null)}>
        <OptionList
          options={(parent?.children ?? []).map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'city'} title={text.add.chooseCity} onClose={() => setSheet(null)}>
        <OptionList
          options={(cities ?? []).map((item) => ({ value: item.id, label: item.name }))}
          value={cityId}
          onChange={(value) => {
            setCityId(value);
            setSheet(null);
          }}
        />
      </Sheet>
    </KeyboardAvoidingView>
  );
}
