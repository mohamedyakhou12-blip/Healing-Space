import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return sample courses (in production, fetch from Firestore)
    const courses = [
      { id: '1', title: 'أساسيات العلاج النفسي المعرفي', instructor: 'د. نسرين', duration: '12 ساعة', students: 234, rating: 4.8, price: '1,500', free: false, status: 'published' },
      { id: '2', title: 'التأمل والاسترخاء للمبتدئين', instructor: 'د. نسرين', duration: '8 ساعات', students: 456, rating: 4.9, price: '0', free: true, status: 'published' },
      { id: '3', title: 'إدارة القلق والتوتر', instructor: 'د. نسرين', duration: '10 ساعات', students: 189, rating: 4.7, price: '1,200', free: false, status: 'published' },
    ];
    return NextResponse.json({ courses });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في جلب الدورات' }, { status: 500 });
  }
}
