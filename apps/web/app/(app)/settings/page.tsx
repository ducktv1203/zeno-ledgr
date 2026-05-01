import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle>Settings and security</CardTitle>
        <CardDescription>
          This page is prepared for account settings, password policy guidance, and
          security controls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
          <li>Supabase account management links</li>
          <li>Encryption session status and lock behavior</li>
          <li>Merchant refiner dictionary management</li>
        </ul>
      </CardContent>
    </Card>
  );
}

