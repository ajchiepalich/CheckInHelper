"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({
  localAuthEnabled,
  entraConfigured,
}: {
  localAuthEnabled: boolean;
  entraConfigured: boolean;
}) {
  const [email, setEmail] = useState("staff@highlands.local");
  const [loading, setLoading] = useState(false);

  async function handleLocalSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("local-dev", {
      email,
      password: "local",
      callbackUrl: "/chat",
    });
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Church of the Highlands documentation assistant for authorized
            staff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entraConfigured ? (
            <Button
              className="w-full"
              onClick={() =>
                signIn("microsoft-entra-id", { callbackUrl: "/chat" })
              }
            >
              Sign in with Microsoft
            </Button>
          ) : null}

          {localAuthEnabled ? (
            <form
              onSubmit={handleLocalSignIn}
              className="space-y-4 rounded-2xl border border-dashed border-[var(--color-gold)] bg-[var(--color-warning-bg)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--color-warning-text)]">
                Local development authentication
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@highlands.local or admin@highlands.local"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Continue with local account
              </Button>
            </form>
          ) : null}

          {!entraConfigured && !localAuthEnabled ? (
            <p className="text-sm text-[var(--color-error)]">
              Authentication is not configured. Set Entra credentials or enable
              LOCAL_AUTH_ENABLED.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
