import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthLayoutCard({ title, description, children }: Props) {
  return (
    <Card className="app-surface mx-auto w-full max-w-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

