'use client';

import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Heart, Users, MapPin, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const { language } = useStore();
  const t = useTranslation(language);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-blue-700 mb-4">
              {language === 'ru' ? 'О проекте ASAR.kz' : language === 'kk' ? 'ASAR.kz жобасы туралы' : 'About ASAR.kz'}
            </h1>
            <p className="text-xl text-gray-600">
              {language === 'ru' 
                ? 'Платформа для экстренной помощи и обмена ресурсами в Казахстане'
                : language === 'kk'
                ? 'Қазақстанда шұғыл көмек және ресурстар алмасу платформасы'
                : 'Platform for emergency help and resource exchange in Kazakhstan'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
            <div className="prose max-w-none">
              <p className="text-lg text-gray-700 mb-6">
                {language === 'ru'
                  ? 'ASAR.kz - это платформа для экстренной помощи и обмена ресурсами в чрезвычайных ситуациях. Наша миссия - помочь людям быстро находить помощь и оказывать поддержку друг другу в трудные моменты.'
                  : language === 'kk'
                  ? 'ASAR.kz - бұл төтенше жағдайларда шұғыл көмек және ресурстар алмасу платформасы. Біздің миссиямыз - адамдарға тез көмек табуға және қиын сәттерде бір-біріне қолдау көрсетуге көмектесу.'
                  : 'ASAR.kz is a platform for emergency help and resource exchange in emergency situations. Our mission is to help people quickly find help and support each other in difficult times.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="flex items-start space-x-4">
                  <div className="bg-red-50 p-3 rounded-md border border-red-200">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">
                      {language === 'ru' ? 'Экстренная помощь' : language === 'kk' ? 'Шұғыл көмек' : 'Emergency Help'}
                    </h3>
                    <p className="text-gray-600">
                      {language === 'ru'
                        ? 'Быстрое создание заявок на экстренную помощь с геолокацией'
                        : language === 'kk'
                        ? 'Геолокациямен шұғыл көмекке тез өтініштер жасау'
                        : 'Quick creation of emergency help requests with geolocation'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-green-50 p-3 rounded-md border border-green-200">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">
                      {language === 'ru' ? 'Волонтерство' : language === 'kk' ? 'Еріктілік' : 'Volunteering'}
                    </h3>
                    <p className="text-gray-600">
                      {language === 'ru'
                        ? 'Откликайтесь на заявки и помогайте нуждающимся'
                        : language === 'kk'
                        ? 'Өтініштерге жауап беріп, қажеттілерге көмектесіңіз'
                        : 'Respond to applications and help those in need'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">
                      {language === 'ru' ? 'Геолокация' : language === 'kk' ? 'Геолокация' : 'Geolocation'}
                    </h3>
                    <p className="text-gray-600">
                      {language === 'ru'
                        ? 'Точное определение местоположения для быстрой помощи'
                        : language === 'kk'
                        ? 'Жылдам көмек үшін дәл орналасқан жерін анықтау'
                        : 'Accurate location determination for quick help'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                    <Heart className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">
                      {language === 'ru' ? 'Сообщество' : language === 'kk' ? 'Қауымдастық' : 'Community'}
                    </h3>
                    <p className="text-gray-600">
                      {language === 'ru'
                        ? 'Рейтинговая система для надежных помощников'
                        : language === 'kk'
                        ? 'Сенімді көмекшілер үшін рейтингтік жүйе'
                        : 'Rating system for reliable helpers'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-lg shadow-sm border border-blue-700 p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-4">
              {language === 'ru' ? 'Присоединяйтесь к нам!' : language === 'kk' ? 'Бізбен бірге болыңыз!' : 'Join us!'}
            </h2>
            <p className="text-lg mb-6 text-blue-100">
              {language === 'ru'
                ? 'Помогайте другим и получайте помощь, когда она нужна'
                : language === 'kk'
                ? 'Басқаларға көмектесіңіз және қажет болғанда көмек алыңыз'
                : 'Help others and get help when you need it'}
            </p>
            <Link href="/sign-up" className="btn bg-white text-blue-700 hover:bg-gray-50 inline-block border border-gray-300">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

