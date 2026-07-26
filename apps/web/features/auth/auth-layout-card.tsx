type Props = {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthLayoutCard({ eyebrow, title, description, children }: Props) {
  return (
    <div className="space-y-7">
      <header className="space-y-2.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-display text-[2rem] leading-tight">{title}</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </header>
      <hr className="hairline" />
      {children}
    </div>
  );
}
