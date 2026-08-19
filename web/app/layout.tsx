import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'سوق الرقة',
  description: 'بيع واشترِ داخل مدينتك — تطبيق سوق الرقة',
};

export const viewport: Viewport = {
  themeColor: '#0B7A5D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* الخط من ملفاتنا لا من الإنترنت؟ هنا الويب — نستخدم Google Fonts
            لأن الصفحة تُفتح بمتصفّح لا بتطبيق، والخط يُخزَّن بعد أول زيارة. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
