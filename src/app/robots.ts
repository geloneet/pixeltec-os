import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/perfil",
          "/notificaciones",
          "/dashboard",
          "/hoy",
          "/clientes",
          "/proyectos",
          "/herramientas",
          "/vps",
          "/crypto-intel",
          "/api/",
        ],
      },
    ],
    sitemap: "https://pixeltec.mx/sitemap.xml",
  };
}
