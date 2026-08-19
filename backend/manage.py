#!/usr/bin/env python
"""أداة إدارة Django."""

import os
import sys


def _force_utf8_console():
    """
    كل رسائل هذا المشروع بالعربية، وطرفية ويندوز الافتراضية cp1252 تكسرها.
    نضبط الترميز هنا مرة واحدة بدل مطالبة كل مطوّر بضبط PYTHONIOENCODING.
    """
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def main():
    _force_utf8_console()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "souq.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "تعذّر استيراد Django. تأكّد أنك فعّلت البيئة الافتراضية "
            "وثبّت المتطلبات: pip install -r requirements.txt"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
