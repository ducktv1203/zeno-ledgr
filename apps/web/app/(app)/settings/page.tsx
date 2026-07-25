import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, KeyRound, Users } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Security posture
          </CardTitle>
          <CardDescription>
            Confirm environment and encryption state before ingestion runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          JWT verification runs through JWKS for cloud-first auth trust.
        </CardContent>
      </Card>
      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Key lifecycle
          </CardTitle>
          <CardDescription>
            Master password unlocks a session-memory AES key only.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Locking session clears key material from in-memory module state.
        </CardContent>
      </Card>
      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team operating notes
          </CardTitle>
          <CardDescription>
            Add governance docs here for security reviews and wallet import workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Keep all merchant refinement dictionaries versioned and peer-reviewed.
        </CardContent>
      </Card>
    </div>
  );
}

