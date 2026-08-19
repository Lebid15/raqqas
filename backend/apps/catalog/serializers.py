import uuid

from django.utils.text import slugify
from rest_framework import serializers

from .models import Category, City, Neighborhood


class TranslatedMixin(serializers.Serializer):
    """
    يُرجع `name` باللغة النشطة، و`names` بكل اللغات.

    سبب إرجاع الاثنين: التطبيق يخزّن الأقسام محليًا ليعمل بلا إنترنت،
    فلو غيّر المستخدم اللغة وهو غير متصل لا نريد أن تفرغ الأسماء.
    """

    name = serializers.SerializerMethodField()
    names = serializers.SerializerMethodField()

    def get_name(self, obj) -> str:
        return obj.name_for(self._lang())

    def get_names(self, obj) -> dict:
        return {"ar": obj.name_ar, "tr": obj.name_tr or obj.name_ar, "en": obj.name_en or obj.name_ar}

    def _lang(self) -> str:
        return getattr(self.context.get("request"), "lang", "ar")


class NeighborhoodSerializer(TranslatedMixin, serializers.ModelSerializer):
    class Meta:
        model = Neighborhood
        fields = ["id", "slug", "name", "names", "city_id", "sort_order"]


class CitySerializer(TranslatedMixin, serializers.ModelSerializer):
    neighborhoods = NeighborhoodSerializer(many=True, read_only=True)

    class Meta:
        model = City
        fields = ["id", "slug", "name", "names", "sort_order", "neighborhoods"]


class SubCategorySerializer(TranslatedMixin, serializers.ModelSerializer):
    listings_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "names", "icon", "sort_order", "listings_count"]


class CategorySerializer(TranslatedMixin, serializers.ModelSerializer):
    children = SubCategorySerializer(many=True, read_only=True)
    listings_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "names", "icon", "sort_order",
                  "listings_count", "children"]

    def get_listings_count(self, obj) -> int:
        """
        عدّاد القسم الرئيسي يشمل أقسامه الفرعية.

        الناس ينشرون في الأقسام الفرعية دائمًا، فلو عددنا المباشر فقط لظهرت
        كل الأقسام الرئيسية بصفر — وهو ما رأيناه فعلًا على الشاشة الأولى.
        الأبناء محمّلون مسبقًا مع عدّاداتهم، فالجمع هنا بلا أي استعلام إضافي.
        """
        own = getattr(obj, "listings_count", 0) or 0
        children = getattr(obj, "_prefetched_objects_cache", {}).get("children")
        if children is None:
            return own
        return own + sum(getattr(child, "listings_count", 0) or 0 for child in children)


# ---------------------------------------------------------------- الكتابة (الإدارة)

class CityWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "slug", "name_ar", "name_tr", "name_en", "is_active", "sort_order"]


class NeighborhoodWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Neighborhood
        fields = ["id", "city", "slug", "name_ar", "name_tr", "name_en",
                  "is_active", "sort_order"]


class CategoryWriteSerializer(serializers.ModelSerializer):
    # المعرّف تقنيّ محض ولا يفهمه الأدمن — نولّده إن تُرك فارغًا
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=60)
    listings_count = serializers.IntegerField(read_only=True)
    children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "parent", "slug", "icon", "name_ar", "name_tr", "name_en",
                  "is_active", "sort_order", "listings_count", "children_count"]

    def validate_name_ar(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("اسم القسم قصير جدًا.")
        return value

    def validate(self, attrs):
        parent = attrs.get("parent")
        if parent and parent.parent_id:
            raise serializers.ValidationError(
                {"parent": "مستويان فقط: قسم رئيسي وقسم فرعي."}
            )
        if self.instance and parent and parent.pk == self.instance.pk:
            raise serializers.ValidationError({"parent": "لا يمكن أن يكون القسم أبًا لنفسه."})

        # نقل قسم رئيسي له أبناء إلى تحت قسم آخر يخلق ثلاثة مستويات
        if self.instance and parent and self.instance.children.exists():
            raise serializers.ValidationError(
                {"parent": "هذا القسم له أقسام فرعية — انقلها أولًا أو احذفها."}
            )

        if not attrs.get("slug") and not (self.instance and self.instance.slug):
            attrs["slug"] = self._generate_slug(attrs.get("name_ar", ""))
        elif not attrs.get("slug"):
            attrs.pop("slug", None)
        return attrs

    @staticmethod
    def _generate_slug(name: str) -> str:
        """
        معرّف لاتيني من اسم عربي.

        `slugify` يُفرغ النص العربي تمامًا، فنقع على معرّف مرقّم مضمون التفرّد
        بدل رفض الحفظ في وجه الأدمن لسبب لا يعنيه.
        """
        base = slugify(name, allow_unicode=False) or f"cat-{uuid.uuid4().hex[:8]}"
        candidate, index = base, 2
        while Category.objects.filter(slug=candidate).exists():
            candidate = f"{base}-{index}"
            index += 1
        return candidate
