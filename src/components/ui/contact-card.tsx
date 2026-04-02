// contact-card.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import {
	LucideIcon,
	PlusIcon,
} from 'lucide-react';

type ContactInfoProps = React.ComponentProps<'div'> & {
	icon: LucideIcon;
	label: string;
	value: string;
};

type ContactCardProps = React.ComponentProps<'div'> & {
	title?: string;
	description?: string;
	contactInfo?: ContactInfoProps[];
	formSectionClassName?: string;
};

export function ContactCard({
	title = 'Hablemos de tu proyecto',
	description = '¿Listo para automatizar y escalar? Llena el formulario y nuestro equipo de consultores se pondrá en contacto contigo a la brevedad.',
	contactInfo,
	className,
	formSectionClassName,
	children,
	...props
}: ContactCardProps) {
	return (
		<div
			className={cn(
				'bg-[#0a0a0a] border border-white/10 relative grid w-full shadow-2xl shadow-cyan-900/10 md:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden',
				className,
			)}
			{...props}
		>
			<PlusIcon className="absolute -top-3 -left-3 h-6 w-6 text-cyan-500" />
			<PlusIcon className="absolute -top-3 -right-3 h-6 w-6 text-cyan-500" />
			<PlusIcon className="absolute -bottom-3 -left-3 h-6 w-6 text-cyan-500" />
			<PlusIcon className="absolute -right-3 -bottom-3 h-6 w-6 text-cyan-500" />
			<div className="flex flex-col justify-between lg:col-span-2">
				<div className="relative h-full space-y-6 px-6 py-10 md:p-12">
					<h2 className="text-3xl font-bold md:text-4xl lg:text-5xl text-white tracking-tight">
						{title}
					</h2>
					<p className="text-white/60 max-w-xl text-base lg:text-lg font-light leading-relaxed tracking-wide">
						{description}
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8">
						{contactInfo?.map((info, index) => (
							<ContactInfo key={index} {...info} />
						))}
					</div>
				</div>
			</div>
			<div
				className={cn(
					'bg-[#111111] flex h-full w-full items-center border-t border-white/10 p-6 md:p-8 lg:p-12 md:col-span-1 lg:col-span-1 md:border-t-0 md:border-l rounded-b-xl md:rounded-r-xl md:rounded-bl-none',
					formSectionClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

function ContactInfo({
	icon: Icon,
	label,
	value,
	className,
	...props
}: ContactInfoProps) {
	return (
		<div className={cn('flex items-center gap-4 py-3', className)} {...props}>
			<div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
				<Icon className="h-5 w-5 text-primary" />
			</div>
			<div>
				<p className="font-medium text-white/90">{label}</p>
				<p className="text-white/50 text-sm mt-1">{value}</p>
			</div>
		</div>
	);
}
