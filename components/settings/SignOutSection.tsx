import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

export default function SignOutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign out</CardTitle>
        <CardDescription>
          End your session on this device. You can sign back in any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={logout}>
          <Button type="submit" variant="destructive">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
