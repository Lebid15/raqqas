import { File, UploadType } from 'expo-file-system';

import { ApiError, api, OfflineError } from './client';
import { API_URL, UPLOAD_TIMEOUT_MS } from '../config';
import type { Media } from './types';

/** صورة اختارها المستخدم من جهازه ولم تُرفع بعد. */
export type PickedPhoto = { uri: string; name: string; type: string };

export type UploadOutcome = {
  uploaded: Media[];
  /** الصور التي لم تُرفع — تبقى في الشاشة ليعيد المستخدم المحاولة عليها وحدها. */
  failed: PickedPhoto[];
  /** رسالة صالحة للعرض للمستخدم، إن فشل شيء. */
  message?: string;
  /** نصّ الخطأ التقني — سطر صغير تحت الرسالة، يختصر ساعات تشخيص. */
  detail?: string;
};

/**
 * رفع صورة واحدة عبر الطبقة الأصلية (`expo-file-system`).
 *
 * **لماذا لا نستعمل `fetch` مع `FormData`؟** لأن ذلك المسار كان يفشل عندنا قبل
 * أن يخرج بايت واحد من الجهاز: يبني أندرويد جسم الطلب بنفسه من مسار الملف،
 * وإن تعذّر فتحه أُلغي الطلب كاملًا فلا يصل الخادمَ شيء ولا يُسجَّل أثر.
 *
 * هذه الدالة تسلّم مسار الملف للطبقة الأصلية مباشرة، فتقرأه وترفعه وتعيد
 * ردّ الخادم كما هو — بلا وسيط JavaScript يبني multipart.
 */
async function send(listingId: number, photo: PickedPhoto, token: string | null) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    return await new File(photo.uri).upload(`${API_URL}/listings/${listingId}/media`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'images',
      mimeType: photo.type,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function uploadOne(listingId: number, photo: PickedPhoto): Promise<Media[]> {
  let result = await send(listingId, photo, api.accessToken);

  // انتهت صلاحية الرمز أثناء الرفع الطويل — نجدّده مرة ونعيد المحاولة بصمت
  if (result.status === 401) {
    const renewed = await api.renewAccessToken();
    if (renewed) result = await send(listingId, photo, renewed);
  }

  if (result.status >= 400) {
    const error = safeJson(result.body)?.error;
    throw new ApiError(result.status, {
      code: error?.code,
      message: error?.fields?.images?.[0] ?? error?.message ?? 'تعذّر رفع الصورة.',
      fields: error?.fields,
    });
  }

  return (safeJson(result.body) ?? []) as Media[];
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * رفع صور إعلان.
 *
 * **صورة واحدة في كل طلب، بالتتابع.** الدفعة الواحدة كانت تعني أن أي عطل —
 * انقطاع، مهلة، ملف واحد لا يُقرأ — يسقط الصور كلها معًا. أما هنا فتنجح الصور
 * السليمة وتُعرَف الفاشلة بعينها، وهذا ما يعمل فعلًا على إنترنت ضعيف.
 *
 * ولا يبتلع خطأً أبدًا: ما يفشل يعود في `failed` برسالته.
 */
export async function uploadPhotos(
  listingId: number,
  photos: PickedPhoto[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadOutcome> {
  const uploaded: Media[] = [];
  const failed: PickedPhoto[] = [];
  let message: string | undefined;
  let detail: string | undefined;

  for (const [index, photo] of photos.entries()) {
    try {
      uploaded.push(...(await uploadOne(listingId, photo)));
    } catch (caught) {
      failed.push(photo);
      // نحتفظ بأول خطأ فقط: عرض خمس رسائل متطابقة لا يفيد أحدًا
      if (!message) {
        if (caught instanceof ApiError) {
          message = caught.fieldError('images') ?? caught.message;
        } else if (caught instanceof OfflineError) {
          message = caught.message;
          detail = caught.detail;
        } else {
          message = 'تعذّر رفع الصورة. تحقّق من الإنترنت وأعد المحاولة.';
          detail = (caught as Error)?.message;
        }
      }
    }

    onProgress?.(index + 1, photos.length);
  }

  return { uploaded, failed, message, detail };
}

/** حذف صورة من إعلان — نهائي وفوري. */
export function deletePhoto(listingId: number, mediaId: number) {
  return api.del(`/listings/${listingId}/media/${mediaId}`);
}
