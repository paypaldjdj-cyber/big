import os
import re

def replace_in_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'useLanguage' not in content:
        content = content.replace('import { useNavigate } from "react-router-dom";', 'import { useNavigate } from "react-router-dom";\nimport { useLanguage } from "../LanguageContext";')
        content = re.sub(r'(export default function \w+\([^)]*\) {\n)', r'\1  const { t } = useLanguage();\n', content)

    for old, new in replacements:
        content = content.replace(old, new)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

base = r'c:\Users\Dell\Desktop\claude 1\dental-clinic\frontend\src\pages'

replace_in_file(os.path.join(base, 'Patients.jsx'), [
    ('"جميع المرضى"', 't("جميع المرضى")'),
    ('"+ إضافة مريض"', 't("+ إضافة مريض")'),
    ('"ابحث بالاسم أو الهاتف..."', 't("ابحث بالاسم أو الهاتف...")'),
    ('"المريض","الهاتف","العمر","آخر زيارة","الحالة","إجراءات"', 't("المريض"),t("الهاتف"),t("العمر"),t("آخر زيارة"),t("الحالة"),t("إجراءات")'),
    ('"لا توجد"', 't("لا توجد")'),
    ('" سنة"', '" " + t("سنة")'),
    ('"ملف"', 't("ملف")'),
    ('"موعد"', 't("موعد")'),
    ('>لا توجد نتائج<', '>{t("لا توجد نتائج")}<'),
    (' مريض\n', ' {t("مريض")}\n'),
    ('>إضافة مريض جديد<', '>{t("إضافة مريض جديد")}<'),
    ('"الاسم الأول *"', 't("الاسم الأول *")'),
    ('"اسم العائلة *"', 't("اسم العائلة *")'),
    ('"رقم الهاتف"', 't("رقم الهاتف")'),
    ('"تاريخ الميلاد"', 't("تاريخ الميلاد")'),
    ('"الجنس"', 't("الجنس")'),
    ('"ذكر","أنثى"', 't("ذكر"),t("أنثى")'),
    ('"فصيلة الدم"', 't("فصيلة الدم")'),
    ('"البريد الإلكتروني"', 't("البريد الإلكتروني")'),
    ('"العنوان"', 't("العنوان")'),
    ('"الحساسيات / ملاحظات طبية"', 't("الحساسيات / ملاحظات طبية")'),
    ('"ملاحظات الطبيب"', 't("ملاحظات الطبيب")'),
    ('>إلغاء<', '>{t("إلغاء")}<'),
    ('"حفظ المريض"', 't("حفظ المريض")'),
    ('"جاري الحفظ..."', 't("جاري الحفظ...")'),
    ('"الرجاء إدخال الاسم"', 't("الرجاء إدخال الاسم")')
])

print('Done')
