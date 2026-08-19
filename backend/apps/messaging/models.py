"""
المحادثة الداخلية — الجداول تُبنى الآن وتبقى فارغة (plan2 §7.4).

النسخة الأولى تعتمد واتساب. بناء الجداول من الآن يعني أن التفعيل لاحقًا
هو إضافة نقاط API وشاشتين — بلا ترحيل مؤلم لقاعدة بيانات فيها بيانات حيّة.
شاشتا design/messages.html و design/chat.html جاهزتان كمرجع بصري.
"""

from django.db import models


class Conversation(models.Model):
    listing = models.ForeignKey(
        "listings.Listing", verbose_name="الإعلان",
        on_delete=models.CASCADE, related_name="conversations",
    )
    buyer = models.ForeignKey(
        "accounts.User", verbose_name="المشتري",
        on_delete=models.CASCADE, related_name="conversations_as_buyer",
    )
    seller = models.ForeignKey(
        "accounts.User", verbose_name="البائع",
        on_delete=models.CASCADE, related_name="conversations_as_seller",
    )
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    buyer_unread = models.PositiveSmallIntegerField(default=0)
    seller_unread = models.PositiveSmallIntegerField(default=0)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "محادثة"
        verbose_name_plural = "المحادثات"
        ordering = ["-last_message_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "buyer"], name="uniq_conversation_per_buyer_listing"
            )
        ]

    def __str__(self) -> str:
        return f"محادثة {self.pk} — إعلان {self.listing_id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="sent_messages"
    )
    body = models.TextField("النص", max_length=2000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "رسالة"
        verbose_name_plural = "الرسائل"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"رسالة {self.pk}"
