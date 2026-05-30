import type { ReactNode } from "react";

/** Root passes through — locale layout owns <html> */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
