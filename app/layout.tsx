import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentLedger | Rental Business Management",
  description: "Manage rental bookings, inventory, payments, and catering jobs in one workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
