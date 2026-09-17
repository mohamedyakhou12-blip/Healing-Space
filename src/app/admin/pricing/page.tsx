'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const planDefinitions = [
  { key: 'full', name: 'الوصول الكامل', fallback: 2000 },
  { key: 'courses', name: 'الدورات فقط', fallback: 500 },
  { key: 'articles', name: 'المقالات فقط', fallback: 500 },
  { key: 'podcasts', name: 'البودكاست فقط', fallback: 500 },
  { key: 'videos', name: 'الفيديوهات فقط', fallback: 500 },
  { key: 'pdfs', name: 'الكتب فقط', fallback: 500 },
  { key: 'live', name: 'البث المباشر فقط', fallback: 500 },
  { key: 'coaching', name: 'الكوتشنغ فقط', fallback: 500 },
];

export default function AdminPricingPage() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [individualPurchasesEnabled, setIndividualPurchasesEnabled] = useState(true);
  const [individualPrice, setIndividualPrice] = useState(200);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-settings?_t=' + Date.now())
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const settings = data.settings || {};
        const nextPrices: Record<string, number> = {};
        for (const plan of planDefinitions) {
          const stored = Number(settings[`subscription_price_${plan.key}`]);
          nextPrices[plan.key] = Number.isFinite(stored) && stored > 0 ? stored : plan.fallback;
        }
        setPrices(nextPrices);
        setIndividualPurchasesEnabled(settings.individualPurchasesEnabled !== 'false');
        const storedIndividual = Number(settings.individualContentPrice);
        if (Number.isFinite(storedIndividual) && storedIndividual > 0) setIndividualPrice(storedIndividual);
      })
      .catch(() => toast.error('تعذر تحميل إعدادات الأسعار'))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings: Record<string, string | number | boolean> = {
        individualPurchasesEnabled,
        individualContentPrice: individualPrice,
      };
      for (const plan of planDefinitions) {
        const value = Number(prices[plan.key]);
        if (!Number.isInteger(value) || value <= 0) throw new Error('يجب أن تكون الأسعار أرقاماً صحيحة أكبر من صفر');
        settings[`subscription_price_${plan.key}`] = value;
      }
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ الإعدادات');
      toast.success('تم حفظ الأسعار والإعدادات بنجاح');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">الأسعار</h1>
        <p className="mt-1 text-muted-foreground">إدارة أسعار الاشتراكات والمحتوى</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>أسعار الاشتراكات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {planDefinitions.map((plan) => (
              <div key={plan.key} className="flex items-center gap-4">
                <Label className="flex-1">{plan.name}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={prices[plan.key] ?? plan.fallback}
                    onChange={(event) => setPrices((current) => ({ ...current, [plan.key]: Number(event.target.value) }))}
                    className="w-28 text-left"
                    dir="ltr"
                    disabled={loading}
                  />
                  <span className="text-sm text-muted-foreground">دج</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>إعدادات الشراء الفردي</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>تفعيل الشراء الفردي</Label>
              <Switch checked={individualPurchasesEnabled} onCheckedChange={setIndividualPurchasesEnabled} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>السعر الافتراضي للمحتوى الفردي</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={individualPrice} onChange={(event) => setIndividualPrice(Number(event.target.value))} className="w-28 text-left" dir="ltr" />
                <span className="text-sm text-muted-foreground">دج</span>
              </div>
            </div>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-accent" onClick={saveSettings} disabled={saving || loading}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
