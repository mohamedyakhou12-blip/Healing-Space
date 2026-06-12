'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Eye } from 'lucide-react';

const samplePayments = [
  { id: '1', member: 'أحمد محمد', amount: '2,000 دج', plan: 'وصول كامل', method: 'CCP', date: '2026-05-18', status: 'pending' },
  { id: '2', member: 'فاطمة علي', amount: '500 دج', plan: 'دورات', method: 'CCP', date: '2026-05-17', status: 'approved' },
  { id: '3', member: 'كريم حسن', amount: '500 دج', plan: 'بودكاست', method: 'CCP', date: '2026-05-16', status: 'approved' },
  { id: '4', member: 'سارة يوسف', amount: '500 دج', plan: 'مقالات', method: 'CCP', date: '2026-05-15', status: 'rejected' },
];

const statusLabels: Record<string, { text: string; color: string }> = {
  pending: { text: 'قيد المراجعة', color: 'bg-amber-50 text-amber-600' },
  approved: { text: 'مقبول', color: 'bg-green-50 text-green-600' },
  rejected: { text: 'مرفوض', color: 'bg-red-50 text-red-600' },
};

export default function AdminPaymentsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">المدفوعات</h1>
        <p className="text-gray-600 mt-1">مراجعة وإدارة مدفوعات الأعضاء</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-sm border-0">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <span className="text-amber-600 text-lg">⏳</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">معلقة</p>
              <p className="text-xl font-bold text-gray-900">23</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <span className="text-green-600 text-lg">✓</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">مقبولة</p>
              <p className="text-xl font-bold text-gray-900">156</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <span className="text-red-600 text-lg">✗</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">مرفوضة</p>
              <p className="text-xl font-bold text-gray-900">12</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">العضو</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">المبلغ</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">الخطة</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">التاريخ</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">الحالة</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {samplePayments.map((payment) => {
                  const status = statusLabels[payment.status];
                  return (
                    <tr key={payment.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{payment.member}</td>
                      <td className="px-6 py-4 text-sm font-bold">{payment.amount}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{payment.plan}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{payment.date}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                          {payment.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600"><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"><X className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
