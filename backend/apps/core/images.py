"""
معالجة الصور المرفوعة.

التطبيق يضغط قبل الرفع، لكن الخادم لا يثق بذلك: يعيد الترميز دائمًا.
فائدتان: حجم مضمون على إنترنت ضعيف، وتنظيف البيانات الوصفية (EXIF)
التي قد تحمل موقع المستخدم الجغرافي.
"""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 50_000_000  # حماية من صور القنبلة


def _open(file) -> Image.Image:
    try:
        image = Image.open(file)
        image.verify()          # فحص سريع قبل فك الضغط
        file.seek(0)
        image = Image.open(file)
    except Exception as exc:
        raise ValidationError("الملف ليس صورة صالحة.") from exc

    if image.format not in ALLOWED_FORMATS:
        raise ValidationError("الصيغ المقبولة: JPG أو PNG أو WEBP.")
    if image.width * image.height > MAX_PIXELS:
        raise ValidationError("أبعاد الصورة كبيرة جدًا.")
    return image


def _to_jpeg(image: Image.Image, max_edge: int, quality: int) -> tuple[bytes, int, int]:
    image = ImageOps.exif_transpose(image)   # يصحّح دوران صور الجوال

    if image.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        converted = image.convert("RGBA")
        background.paste(converted, mask=converted.split()[-1])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    image.thumbnail((max_edge, max_edge), Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue(), image.width, image.height


def process_upload(uploaded_file, *, field_name: str = "image") -> dict:
    """
    يعيد: {"full": File, "thumb": File, "width": int, "height": int, "checksum": str}
    """
    if uploaded_file.size > settings.IMAGE_MAX_UPLOAD_BYTES:
        limit = settings.IMAGE_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValidationError(f"حجم الصورة يتجاوز الحد المسموح ({limit} ميغابايت).")

    image = _open(uploaded_file)

    full_bytes, width, height = _to_jpeg(
        image, settings.IMAGE_MAX_EDGE, settings.IMAGE_QUALITY
    )
    uploaded_file.seek(0)
    thumb_bytes, _, _ = _to_jpeg(_open(uploaded_file), settings.IMAGE_THUMB_EDGE, 78)

    checksum = hashlib.sha256(full_bytes).hexdigest()
    stem = Path(getattr(uploaded_file, "name", "photo")).stem[:40] or "photo"
    base = f"{stem}-{checksum[:12]}"

    return {
        "full": _as_file(full_bytes, f"{base}.jpg", field_name),
        "thumb": _as_file(thumb_bytes, f"{base}-t.jpg", field_name),
        "width": width,
        "height": height,
        "checksum": checksum,
        "size": len(full_bytes),
    }


def _as_file(data: bytes, name: str, field_name: str) -> InMemoryUploadedFile:
    buffer = io.BytesIO(data)
    return InMemoryUploadedFile(
        buffer, field_name, name, "image/jpeg", len(data), None
    )
