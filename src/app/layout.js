import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. AQUI ACTUALIZAMOS LOS METADATOS
export const metadata = {
  title: "Asistente UG Reglamentos",
  description: "Asistente virtual para consultar los reglamentos de la Universidad de Guayaquil",
  manifest: "/manifest.json", // <--- VITAL: Conexión con el archivo creado
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mary AI",
  },
};

// 2. AQUI CONFIGURAMOS EL VIEWPORT (Para móviles)
export const viewport = {
  themeColor: "#051535",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Evita que hagan zoom pellizcando
};

export default function RootLayout({ children }) {
  return (
    <html lang="es"> {/* Cambié a 'es' para mejor SEO local */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}