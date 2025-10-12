import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import { AuthProvider } from '@/context/AuthContext';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Invoice Management',
  description: 'Generate invoices from templates effortlessly.',
};

function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <p className="text-white">Loading...</p>
    </div>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <FirebaseClientProvider>
            <Suspense fallback={<RootLoading />}>
              {children}
            </Suspense>
          </FirebaseClientProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
