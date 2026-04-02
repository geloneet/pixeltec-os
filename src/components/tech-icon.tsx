import type { FC, SVGProps } from 'react';

export const TechIcon: FC<SVGProps<SVGSVGElement> & { name: string }> = ({ name, ...props }) => {
  const icons: { [key: string]: JSX.Element } = {
    react: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z" />,
    nextjs: <path d="M9 18V6l7 6-7 6z" />,
    tailwind: <path d="M14.5 12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5zm-10 0c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z" />,
    firebase: <path d="M18.8 3.2l-5.6 17.6-6.4-12.8L18.8 3.2zM5.2 8l8 12.8-10-4.8L5.2 8z" />,
    vercel: <path d="M12 2L2 22h20L12 2z" />,
    nodejs: <path d="M9 21v-8.35L5.5 15l-3-1.73L9 8.23V6h6v2.23l6.5-5.04-3 1.73L15 12.65V21H9z" />,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};
