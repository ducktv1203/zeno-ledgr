import { KeyRound, Shield, FileStack } from "lucide-react";

const NOTES = [
  {
    icon: Shield,
    n: "01",
    title: "Security posture",
    lead: "What the backend can and cannot see.",
    body: "Auth tokens are verified before any row is served. Ledger rows are returned as ciphertext plus a nonce — the API has no key material and no decryption path.",
  },
  {
    icon: KeyRound,
    n: "02",
    title: "Key lifecycle",
    lead: "Your master password never leaves the tab.",
    body: "It derives an AES-256-GCM key via PBKDF2 (600k iterations) that lives only in memory for this tab. Locking the session, closing the tab, or signing out discards it.",
  },
  {
    icon: FileStack,
    n: "03",
    title: "Statements",
    lead: "Deleting a statement deletes its rows.",
    body: "Each import is tied to a statement record. Removing it cascades to every encrypted row that came from that file, so re-importing a corrected file leaves no duplicates.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">Settings</p>
        <h1 className="font-display text-4xl leading-tight">How this ledger behaves</h1>
        <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Reference notes on the security model. Nothing here is configurable yet — it documents
          what the app actually does.
        </p>
      </header>

      <div className="grid gap-px border-y border-border bg-border md:grid-cols-3">
        {NOTES.map(({ icon: Icon, ...note }) => (
          <article key={note.n} className="space-y-3 bg-background py-8 md:px-6 md:first:pl-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-2xl text-oxblood">{note.n}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-normal">{note.title}</h2>
              <p className="text-[13px] text-foreground/70">{note.lead}</p>
            </div>
            <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              {note.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
