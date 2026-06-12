'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-600 mt-1">إعدادات المنصة العامة</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>معلومات الدفع CCP</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>رقم الحساب البريدي CCP</Label>
              <Input placeholder="أدخل رقم CCP" dir="ltr" className="text-left" />
            </div>
            <div className="space-y-2">
              <Label>اسم صاحب الحساب</Label>
              <Input placeholder="أدخل اسم صاحب الحساب" />
            </div>
            <div className="space-y-2">
              <Label>الولاية</Label>
              <Input placeholder="أدخل الولاية" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>إعدادات عامة</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>رمز وصول المشرف</Label>
              <Input type="password" placeholder="أدخل رمز وصول المشرف الجديد" dir="ltr" className="text-left" />
            </div>
            <div className="flex items-center justify-between">
              <Label>تفعيل التسجيل الجديد</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>الصيانة</Label>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">حفظ جميع الإعدادات</Button>
      </div>
    </div>
  );
}
