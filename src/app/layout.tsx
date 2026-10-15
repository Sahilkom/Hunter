import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hunter Memory — Job Hunting Workspace",
  description:
    "Find Software Engineer roles in India, tailor and update your resume, and track applications in one workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body
        className="min-h-full font-sans text-[var(--ink)]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
