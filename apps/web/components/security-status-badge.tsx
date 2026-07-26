"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff } from "lucide-react";

type Props = {
  encryptionActive: boolean;
};

export function SecurityStatusBadge({ encryptionActive }: Props) {
  if (encryptionActive) {
    return (
      <Badge variant="success">
        <Shield className="h-3 w-3" aria-hidden />
        Key in memory
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <ShieldOff className="h-3 w-3" aria-hidden />
      Locked
    </Badge>
  );
}
