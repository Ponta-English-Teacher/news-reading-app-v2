// src/app/layout.tsx
import "./globals.css"; // make sure global styles load

export const metadata = { 
  title: "News Reading App" 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* global theme colors come from globals.css */}
      <body className="bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
