'use client';

import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Clock, Star, Users, BookOpen, Play, Lock } from 'lucide-react';
import Link from 'next/link';

// Sample course detail data
const courseData = {
  title: 'أساسيات العلاج النفسي المعرفي',
  instructor: 'د. نسرين',
  duration: '12 ساعة',
  students: 234,
  rating: 4.8,
  price: '1,500 دج',
  description: 'دورة شاملة تقدم أساسيات العلاج النفسي المعرفي السلوكي، تغطي المبادئ الأساسية والتطبيقات العملية في جلسات العلاج النفسي.',
  chapters: [
    {
      title: 'الفصل الأول: مدخل إلى العلاج المعرفي السلوكي',
      lessons: [
        { title: 'تعريف العلاج المعرفي السلوكي', duration: '45 دقيقة', free: true },
        { title: 'تاريخ وتطور العلاج المعرفي', duration: '38 دقيقة', free: false },
        { title: 'المبادئ الأساسية', duration: '52 دقيقة', free: false },
      ],
    },
    {
      title: 'الفصل الثاني: التشخيص والتقييم',
      lessons: [
        { title: 'أدوات التشخيص النفسي', duration: '41 دقيقة', free: false },
        { title: 'تقييم الحالة النفسية', duration: '55 دقيقة', free: false },
      ],
    },
    {
      title: 'الفصل الثالث: تقنيات العلاج',
      lessons: [
        { title: 'إعادة البناء المعرفي', duration: '48 دقيقة', free: true },
        { title: 'التعرض ومنع الاستجابة', duration: '39 دقيقة', free: false },
        { title: 'التدريب على الاسترخاء', duration: '35 دقيقة', free: false },
      ],
    },
  ],
};

export default function CourseDetailPage() {
  const params = useParams();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Course Header */}
          <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-8 text-white mb-8">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold mb-4">{courseData.title}</h1>
              <p className="text-teal-100 mb-6 leading-relaxed">{courseData.description}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400 fill-amber-400" /> {courseData.rating}</div>
                <div className="flex items-center gap-1"><Users className="h-4 w-4" /> {courseData.students} طالب</div>
                <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> {courseData.duration}</div>
                <div className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {courseData.chapters.length} فصول</div>
              </div>
              <div className="mt-6 flex gap-4">
                <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold">
                  اشترك الآن - {courseData.price}
                </Button>
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  إضافة للمفضلة
                </Button>
              </div>
            </div>
          </div>

          {/* Course Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-900 mb-4">محتوى الدورة</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {courseData.chapters.map((chapter, chapterIdx) => (
                  <AccordionItem key={chapterIdx} value={`chapter-${chapterIdx}`} className="bg-white rounded-lg shadow-sm border-0 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">
                          {chapterIdx + 1}
                        </span>
                        <span className="font-medium text-gray-900">{chapter.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-2">
                        {chapter.lessons.map((lesson, lessonIdx) => (
                          <div key={lessonIdx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              {lesson.free ? (
                                <Play className="h-4 w-4 text-teal-600" />
                              ) : (
                                <Lock className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="text-sm text-gray-700">{lesson.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">{lesson.duration}</span>
                              {lesson.free && (
                                <span className="text-xs text-teal-600 font-medium">مجاني</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Sidebar */}
            <div>
              <Card className="shadow-sm border-0 sticky top-20">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-4">عن المدربة</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-teal-700 font-bold">ن</span>
                    </div>
                    <div>
                      <p className="font-medium">{courseData.instructor}</p>
                      <p className="text-sm text-gray-500">أخصائية نفسية</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>خبيرة في العلاج النفسي المعرفي السلوكي مع أكثر من 15 سنة خبرة.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
