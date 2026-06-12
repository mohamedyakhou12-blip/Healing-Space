'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, FileText, Headphones, Video, BookMarked, Radio } from 'lucide-react';
import { motion } from 'framer-motion';

const services = [
  {
    icon: BookOpen,
    title: 'الدورات التعليمية',
    description: 'دورات متخصصة في العلاج النفسي والتطوير الذاتي مع شهادات معتمدة',
    href: '/courses',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    icon: FileText,
    title: 'المقالات',
    description: 'مقالات علمية متخصصة في الصحة النفسية والعلاج النفسي',
    href: '/articles',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Headphones,
    title: 'البودكاست',
    description: 'حلقات صوتية ملهمة حول التطوير الذاتي والصحة النفسية',
    href: '/podcasts',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Video,
    title: 'الفيديوهات',
    description: 'فيديوهات تعليمية عالية الجودة مع محتوى حصري',
    href: '/videos',
    color: 'text-red-600 bg-red-50',
  },
  {
    icon: BookMarked,
    title: 'الكتب الإلكترونية',
    description: 'كتب ومستندات PDF قابلة للتحميل مع معاينة مباشرة',
    href: '/books',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: Radio,
    title: 'البث المباشر',
    description: 'جلسات تفاعلية حية مع الدكتورة نسرين والمداولة المباشرة',
    href: '/live',
    color: 'text-rose-600 bg-rose-50',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function ServicesGrid() {
  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">خدماتنا</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            نقدم لك مجموعة متنوعة من المحتوى التعليمي المتخصص لتطوير مهاراتك ومعرفتك
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {services.map((service) => (
            <motion.div key={service.href} variants={item}>
              <Link href={service.href}>
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-xl ${service.color} flex items-center justify-center mb-4`}>
                      <service.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{service.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
