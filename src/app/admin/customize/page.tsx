'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function AdminCustomizePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">تخصيص الصفحة الرئيسية</h1>
        <p className="text-gray-600 mt-1">تعديل مظهر ومحتوى الصفحة الرئيسية</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>قسم البطل (Hero)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>العنوان الرئيسي (عربي)</Label>
              <Input defaultValue="فضاء الشفاء" />
            </div>
            <div className="space-y-2">
              <Label>العنوان الفرعي (عربي)</Label>
              <Input defaultValue="منصة الدكتورة نسرين التعليمية" />
            </div>
            <div className="space-y-2">
              <Label>الوصف (عربي)</Label>
              <Input defaultValue="اكتشف عالماً من المعرفة في مجال العلاج النفسي والتطوير الذاتي" />
            </div>
            <div className="flex items-center justify-between">
              <Label>إظهار قسم البطل</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>فيديو المقدمة</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>رابط الفيديو</Label>
              <Input placeholder="أدخل رابط YouTube أو الفيديو" dir="ltr" className="text-left" />
            </div>
            <div className="flex items-center justify-between">
              <Label>إظهار الفيديو</Label>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>شبكة الخدمات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {['الدورات', 'المقالات', 'البودكاست', 'الفيديوهات', 'الكتب', 'البث المباشر'].map((service) => (
              <div key={service} className="flex items-center justify-between">
                <Label>{service}</Label>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">حفظ التخصيصات</Button>
      </div>
    </div>
  );
}
