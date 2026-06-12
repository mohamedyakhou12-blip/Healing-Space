'use client';

import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Calendar, User, ArrowLeft, Share2, Bookmark } from 'lucide-react';
import Link from 'next/link';

const articleData = {
  title: 'كيف تتغلب على القلق اليومي',
  category: 'صحة نفسية',
  readTime: '5 دقائق',
  date: '15 مايو 2026',
  author: 'د. نسرين',
  content: `
    <h2>مقدمة</h2>
    <p>القلق هو شعور طبيعي يمر به الجميع، لكن عندما يصبح مزمناً ويؤثر على حياتك اليومية، فإنه يحتاج إلى تدخل وعلاج مناسب. في هذا المقال، سنتناول استراتيجيات عملية وفعالة للتغلب على القلق اليومي.</p>
    
    <h2>فهم القلق</h2>
    <p>القلق هو استجابة الجسم الطبيعية للتوتر. يمكن أن يكون مفيداً في بعض المواقف لأنه ينبهنا إلى الخطر ويساعدنا على الاستعداد له. لكن عندما يصبح القلق مفرطاً أو مستمراً، فإنه قد يتحول إلى اضطراب يحتاج إلى علاج.</p>
    
    <h2>استراتيجيات عملية</h2>
    <h3>1. التمارين التنفسية</h3>
    <p>التنفس العميق هو واحدة من أبسط وأكثر الطرق فعالية لتقليل القلق. جرب تقنية 4-7-8: استنشق لمدة 4 ثوانٍ، احبس النفس لمدة 7 ثوانٍ، ثم ازفر لمدة 8 ثوانٍ.</p>
    
    <h3>2. التأمل اليومي</h3>
    <p>ممارسة التأمل لمدة 10-15 دقيقة يومياً يمكن أن تقلل من مستويات القلق بشكل ملموس. ركز على اللحظة الحاضرة واسمح لأفكارك بالمرور دون الحكم عليها.</p>
    
    <h3>3. النشاط البدني</h3>
    <p>التمارين الرياضية تفرز هرمونات السعادة وتقلل من هرمونات التوتر. حاول ممارسة الرياضة لمدة 30 دقيقة على الأقل 3 مرات في الأسبوع.</p>
    
    <h2>خلاصة</h2>
    <p>التغلب على القلق رحلة وليس وجهة. كن صبوراً مع نفسك وتذكر أن التغيير يأتي تدريجياً. إذا استمر القلق في التأثير على حياتك، لا تتردد في طلب المساعدة المهنية.</p>
  `,
  relatedArticles: [
    { title: 'أهمية الصحة النفسية', href: '/articles/2' },
    { title: 'التعامل مع الاكتئاب', href: '/articles/5' },
  ],
};

export default function ArticleDetailPage() {
  const params = useParams();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link href="/articles" className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 mb-6">
            <ArrowLeft className="h-4 w-4" />
            العودة للمقالات
          </Link>

          <article className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{articleData.category}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{articleData.title}</h1>
            <div className="flex items-center gap-6 text-sm text-gray-500 mb-8 pb-6 border-b">
              <div className="flex items-center gap-1"><User className="h-4 w-4" />{articleData.author}</div>
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" />{articleData.date}</div>
              <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{articleData.readTime}</div>
            </div>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed [&_h2]:text-teal-800 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4" dangerouslySetInnerHTML={{ __html: articleData.content }} />
          </article>

          {/* Related articles */}
          {articleData.relatedArticles.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">مقالات ذات صلة</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {articleData.relatedArticles.map((related) => (
                  <Link key={related.href} href={related.href}>
                    <Card className="hover:shadow-md transition-all border-0 shadow-sm cursor-pointer">
                      <CardContent className="p-4">
                        <h3 className="font-medium text-gray-900">{related.title}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
