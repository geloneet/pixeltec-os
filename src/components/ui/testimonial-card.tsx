import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TestimonialAuthor {
  name: string;
  title: string;
  icon: React.ReactNode;
}

interface TestimonialCardProps {
  author: TestimonialAuthor;
  text: string;
  href?: string;
  className?: string;
}

export function TestimonialCard({ author, text, href, className }: TestimonialCardProps) {
  const CardContent = (
    <div className={cn(
      "relative flex h-full w-[22.5rem] flex-col justify-between gap-6 rounded-2xl p-6 transition-colors",
      "bg-card border border-border text-card-foreground",
      "hover:bg-accent",
      className,
    )}>
      <div className="flex-1">
        <div className="flex gap-1 mb-4">
          {Array(5).fill(0).map((_, i) => (
            <Star key={i} className="h-5 w-5 text-primary fill-primary" />
          ))}
        </div>
        <p className="text-base font-light text-foreground">{text}</p>
      </div>
      <div className="flex items-center gap-4">
        {author.icon}
        <div className="flex flex-col">
          <p className="font-semibold text-foreground">{author.name}</p>
          <p className="text-sm text-muted-foreground">{author.title}</p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {CardContent}
      </a>
    );
  }

  return CardContent;
}
