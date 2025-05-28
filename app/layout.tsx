import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import ActivityLog from '@/components/ActivityLog';

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Language Learning Card Generator",
  description: "Generate emoji-style images for language learning cards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} font-mono antialiased`}>
        {children}
        <ActivityLog />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#171717',
              color: '#E5E5E5',
              border: '1px solid #404040',
              borderRadius: '6px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#171717',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#171717',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
