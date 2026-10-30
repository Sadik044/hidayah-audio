import React from 'react';

export const WelcomeBanner: React.FC = () => {
  return (
    <section
      className="relative w-full h-[320px] md:h-[280px] rounded-[22px] overflow-hidden border border-[#E6E7E2]/70 dark:border-[#233128]/70 shadow-sm transition-all"
      style={{
        backgroundImage: `url('/quran-rehal-banner.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      aria-label="স্বাগতম ব্যানার"
    >
      {/* 
        Subtle Translucent Overlay:
        Light mode: Soft warm ivory gradient preserving photographic clarity while boosting center text contrast.
        Dark mode: Rich forest-green translucent gradient.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F6]/80 via-[#FAF9F6]/75 to-[#FAF9F6]/82 dark:from-[#081710]/85 dark:via-[#081710]/80 dark:to-[#081710]/88 transition-colors" />

      {/* Centered Vertical Content Container */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-4 sm:px-6 md:px-10 max-w-3xl mx-auto space-y-2 md:space-y-2.5">
        {/* 1. Arabic Bismillah: Amiri, 38px desktop / 29px mobile, Bold (700), Light #087653, Dark #65C99B */}
        <h2
          dir="rtl"
          lang="ar"
          className="font-arabic text-[29px] md:text-[38px] text-[#087653] dark:text-[#65C99B] font-bold leading-normal tracking-normal select-text py-0.5"
          aria-label="বিসমিল্লাহির রাহমানির রাহিম"
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </h2>

        {/* 2. Bengali Meaning: Hind Siliguri, 16px, Semibold (600), Light #263B32, Dark #D8E5DC */}
        <p className="font-sans text-[15px] md:text-[16px] text-[#263B32] dark:text-[#D8E5DC] font-semibold leading-snug select-text">
          পরম করুণাময়, অসীম দয়ালু আল্লাহর নামে।
        </p>

        {/* 3. Main Message: Hind Siliguri, 19px, Bold (700), Light #17231D, Dark #F3F5F1 */}
        <h3 className="font-sans text-[17px] md:text-[19px] text-[#17231D] dark:text-[#F3F5F1] font-bold tracking-tight leading-snug pt-0.5 select-text">
          শুরু হোক আল্লাহর নামে, পথচলা হোক কল্যাণের পথে।
        </h3>

        {/* 4. Supporting Message: Hind Siliguri, 14px, Semibold (600), Light #34443B, Dark #C4D0C7 */}
        <p className="font-sans text-[13px] md:text-[14px] text-[#34443B] dark:text-[#C4D0C7] font-semibold leading-relaxed select-text max-w-xl">
          ইসলামের সৌন্দর্য, জ্ঞানের আলো এবং জীবনের পরিবর্তনের কথা শুনুন হিদায়াহ অডিওতে।
        </p>
      </div>
    </section>
  );
};
