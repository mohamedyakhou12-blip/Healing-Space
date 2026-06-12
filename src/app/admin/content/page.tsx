'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus } from 'lucide-react';

const contentTypes = [
  { name: 'الدورات التعليمية', count: 55, href: '/admin/content?type=courses' },
  { name: 'المقالات', count: 230, href: '/admin/content?type=articles' },
  { name: 'البودكاست', count: 45, href: '/admin/content?type=podcasts' },
  { name: 'الفيديوهات', count: 120, href: '/admin/content?type=videos' },
  { name: 'الكتب الإلكترونية', count: 28, href: '/admin/content?type=books' },
  { name: 'البث المباشر', count: 12, href: '/admin/content?type=live' },
];

export default function AdminContentPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المحتوى</h1>
          <p className="text-gray-600 mt-1">إدارة جميع أنواع المحتوى على المنصة</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          إضافة محتوى جديد
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {contentTypes.map((type) => (
          <Card key={type.name} className="shadow-sm border-0 hover:shadow-md transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{type.name}</CardTitle>
              <BookOpen className="h-5 w-5 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{type.count}</div>
              <p className="text-xs text-gray-500 mt-1">عنصر</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
