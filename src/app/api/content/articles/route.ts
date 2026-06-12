import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const articles = [
      { id: '1', title: 'كيف تتغلب على القلق اليومي', category: 'صحة نفسية', readTime: '5 دقائق', status: 'published' },
      { id: '2', title: 'أهمية الصحة النفسية في حياتنا', category: 'تطوير ذاتي', readTime: '7 دقائق', status: 'published' },
    ];
    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في جلب المقالات' }, { status: 500 });
  }
}
