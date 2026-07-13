import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/portal",
          "/blog-admin",
          "/perfil",
          "/notificaciones",
          "/dashboard",
          "/clientes",
          "/proyectos",
          "/accesos",
          "/vps",
          "/api/",
        ],
      },
    ],
    sitemap: "https://pixeltec.mx/sitemap.xml",
  };
}
