"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff } from "lucide-react";

type Props = {
  encryptionActive: boolean;
};

export function SecurityStatusBadge({ encryptionActive }: Props) {
  if (encryptionActive) {
    return (
      <Badge variant="success" className="gap-1.5">
        <Shield className="h-3.5 w-3.5" aria-hidden />
        Encryption active
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5">
      <ShieldOff className="h-3.5 w-3.5" aria-hidden />
      Locked — unlock with master password
    </Badge>
  );
}
