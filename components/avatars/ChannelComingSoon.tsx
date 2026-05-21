import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { buttonVariants } from "@/components/ui/button";

export default function ChannelComingSoon({
  avatarId,
  avatarName,
  channel,
  stepNumber,
}: {
  avatarId: string;
  avatarName: string;
  channel: string;
  stepNumber: number;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Avatars
          </Link>
          <span>/</span>
          <Link href={`/avatars/${avatarId}`} className="hover:underline">
            {avatarName}
          </Link>
          <span>/</span>
          <span className="text-foreground">{channel}</span>
        </div>

        <div className="rounded-lg border border-dashed py-16 text-center space-y-4">
          <h1 className="text-xl font-semibold">{channel} channel</h1>
          <p className="text-muted-foreground">
            This view is coming in Phase 2 Step {stepNumber}.
          </p>
          <Link
            href={`/avatars/${avatarId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back to hub
          </Link>
        </div>
      </main>
    </div>
  );
}
