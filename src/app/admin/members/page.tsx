'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MoreHorizontal } from 'lucide-react';

const sampleMembers = [
  { name: 'أحمد محمد', email: 'ahmed@email.com', plan: 'وصول كامل', status: 'نشط', joined: '2026-01-15' },
  { name: 'فاطمة علي', email: 'fatima@email.com', plan: 'دورات', status: 'نشط', joined: '2026-02-20' },
  { name: 'كريم حسن', email: 'karim@email.com', plan: 'بودكاست', status: 'نشط', joined: '2026-03-10' },
  { name: 'سارة يوسف', email: 'sara@email.com', plan: 'وصول كامل', status: 'معطل', joined: '2026-01-05' },
  { name: 'نور الدين', email: 'nour@email.com', plan: 'مقالات', status: 'نشط', joined: '2026-04-01' },
];

export default function AdminMembersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الأعضاء</h1>
          <p className="text-gray-600 mt-1">عرض وإدارة أعضاء المنصة</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="بحث عن عضو..." className="pr-9 w-64" />
          </div>
        </div>
      </div>

      <Card className="shadow-sm border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">الاسم</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">البريد الإلكتروني</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">الخطة</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">الحالة</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">تاريخ الانضمام</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sampleMembers.map((member, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-teal-700 text-xs font-bold">{member.name.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500" dir="ltr">{member.email}</td>
                    <td className="px-6 py-4 text-sm">{member.plan}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.status === 'نشط' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{member.joined}</td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
