import { SEO_WIDTH, SeoPageHeader } from "@/components/seo/seo-ui";
import { SocialLinksEditor } from "@/components/seo/social-links-editor";
import { getSetting } from "@/lib/settings/queries";
import { SETTING_SOCIAL_LINKS, parseSocialLinks } from "@/lib/seo/social";

export default async function SeoSocialPage() {
  const links = parseSocialLinks(await getSetting(SETTING_SOCIAL_LINKS));
  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader
        title="Redes sociales"
        description="Enlaces del negocio. Los que estén activos se publican como «sameAs» en los datos estructurados que lee Google."
      />
      <div className="mt-8">
        <SocialLinksEditor initial={links} />
      </div>
    </div>
  );
}
