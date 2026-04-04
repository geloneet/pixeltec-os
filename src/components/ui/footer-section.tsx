'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FacebookIcon, InstagramIcon, Phone } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface FooterLink {
	title: string;
	href: string;
	icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
	label: string;
	links: FooterLink[];
}

const footerLinks: FooterSection[] = [
	{
		label: 'Soluciones',
		links: [
			{ title: 'Automatización IA', href: '/services/automatizacion' },
			{ title: 'Ecosistemas Web', href: '/services/ecosistemas-web' },
			{ title: 'Consultoría Tech', href: '/services/consultoria' },
		],
	},
	{
		label: 'Empresa',
		links: [
			{ title: 'Sobre Nosotros', href: '/about' },
			{ title: 'Aviso de Privacidad', href: '/aviso-de-privacidad' },
			{ title: 'Términos de Servicio', href: '/terminos-de-servicio' },
		],
	},
	{
		label: 'Recursos',
		links: [
			{ title: 'Blog', href: '/blog' },
			{ title: 'Contacto', href: '/contact' },
		],
	},
	{
		label: 'Redes Sociales',
		links: [
			{ title: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61556300117500', icon: FacebookIcon },
			{ title: 'Instagram', href: 'https://instagram.com/pixeltecmx', icon: InstagramIcon },
			{ title: 'WhatsApp', href: 'https://api.whatsapp.com/send?phone=523221246680&text=Hola,%20quiero%20informaci%C3%B3n.', icon: Phone },
		],
	},
];

export function Footer() {
	return (
		<footer className="md:rounded-t-[3rem] relative w-full flex flex-col items-center justify-center rounded-t-3xl border-t border-white/10 bg-[radial-gradient(35%_128px_at_50%_0%,theme(colors.cyan.900/40%),transparent)] px-6 py-12 lg:py-16 bg-[#030303] text-white">
			<div className="bg-cyan-500/50 absolute top-0 right-1/2 left-1/2 h-[2px] w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[2px]" />

			<div className="grid w-full max-w-7xl gap-8 xl:grid-cols-3 xl:gap-8 mx-auto">
				<AnimatedContainer className="space-y-4">
					<div className="flex items-center gap-3">
                        <Image src={process.env.NEXT_PUBLIC_LOGO_URL!} alt="PixelTEC Logo" width={32} height={32} className="size-8" />
						<span className="font-logo text-2xl font-extrabold uppercase tracking-tight text-gray-100">
							Pixel<span className="text-brand-blue">Tec</span>
						</span>
                    </div>
                    <p className="text-white/60 mt-4 text-sm leading-relaxed max-w-xs font-light">
                        Arquitectura digital y automatización inteligente para empresas que escalan al ritmo de la innovación.
                    </p>
					<p className="text-white/40 mt-8 text-xs md:mt-6">
						© {new Date().getFullYear()} PixelTEC. Todos los derechos reservados.
					</p>
				</AnimatedContainer>

				<div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
					{footerLinks.map((section, index) => (
						<AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
							<div className="mb-10 md:mb-0">
								<h3 className="text-xs uppercase tracking-wider text-white font-semibold">{section.label}</h3>
								<ul className="text-white/60 mt-4 space-y-3 text-sm font-light">
									{section.links.map((link) => (
										<li key={link.title}>
											<Link
												href={link.href}
												className="hover:text-brand-blue inline-flex items-center transition-colors duration-300"
											>
												{link.icon && <link.icon className="me-2 size-4" />}
												{link.title}
											</Link>
										</li>
									))}
								</ul>
							</div>
						</AnimatedContainer>
					))}
				</div>
			</div>
		</footer>
	);
};

type ViewAnimationProps = {
	delay?: number;
	className?: ComponentProps<typeof motion.div>['className'];
	children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
	const shouldReduceMotion = useReducedMotion();

	if (shouldReduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
			whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
			viewport={{ once: true }}
			transition={{ delay, duration: 0.8 }}
			className={className}
		>
			{children}
		</motion.div>
	);
};
