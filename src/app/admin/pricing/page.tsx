'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function AdminPricingPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">الأسعار</h1>
        <p className="text-gray-600 mt-1">إدارة أسعار الاشتراكات والمحتوى</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>أسعار الاشتراكات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: 'الوصول الكامل', price: '2000' },
              { name: 'الدورات فقط', price: '500' },
              { name: 'المقالات فقط', price: '500' },
              { name: 'البودكاست فقط', price: '500' },
              { name: 'الفيديوهات فقط', price: '500' },
              { name: 'الكتب فقط', price: '500' },
              { name: 'البث المباشر فقط', price: '500' },
            ].map((plan) => (
              <div key={plan.name} className="flex items-center gap-4">
                <Label className="flex-1">{plan.name}</Label>
                <div className="flex items-center gap-2">
                  <Input defaultValue={plan.price} className="w-28 text-left" dir="ltr" />
                  <span className="text-sm text-gray-500">دج</span>
                </div>
              </div>
            ))}
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">حفظ الأسعار</Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle>إعدادات الشراء الفردي</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>تفعيل الشراء الفردي</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>السعر الافتراضي للمحتوى الفردي</Label>
              <div className="flex items-center gap-2">
                <Input defaultValue="200" className="w-28 text-left" dir="ltr" />
                <span className="text-sm text-gray-500">دج</span>
              </div>
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">حفظ الإعدادات</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
