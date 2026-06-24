import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Earth Explorer | Interactive 3D Earth Visualization",
  description: "A stunning interactive 3D visualization of Earth featuring live aircraft tracking, satellite orbits, ISS tracking, weather systems, and educational space missions. Explore our planet like never before.",
  keywords: "earth, 3d globe, aircraft tracking, satellites, ISS, space, orbital mechanics, education",
  authors: [{ name: "Earth Explorer" }],
  openGraph: {
    title: "Earth Explorer | Digital Twin of Planet Earth",
    description: "Explore Earth in photorealistic 3D. Track aircraft, satellites, the ISS, and weather systems in real-time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0e27" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
