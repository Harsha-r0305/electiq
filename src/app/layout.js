import './globals.css';
import Shell from '@/components/Shell';

export const metadata = { title: 'ElectIQ', description: 'Course and elective intelligence for students' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
