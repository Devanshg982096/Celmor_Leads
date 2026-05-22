"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateDisplayName, updatePassword } from "@/lib/settings/actions";

interface Props {
  displayName: string;
  email: string;
}

export default function ProfileSection({
  displayName: initialName,
  email,
}: Props) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [isSavingName, startNameTransition] = useTransition();

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [isSavingPw, startPwTransition] = useTransition();

  const dirty = name.trim() !== savedName;

  function saveName() {
    setNameError(null);
    setNameSaved(false);
    startNameTransition(async () => {
      const result = await updateDisplayName(name);
      if ("error" in result && result.error) {
        setNameError(result.error);
        return;
      }
      setSavedName(name.trim());
      setNameSaved(true);
    });
  }

  function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);
    if (pw !== pwConfirm) {
      setPwError("Passwords do not match.");
      return;
    }
    startPwTransition(async () => {
      const result = await updatePassword(pw);
      if ("error" in result && result.error) {
        setPwError(result.error);
        return;
      }
      setPw("");
      setPwConfirm("");
      setPwOpen(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          How you appear inside Narada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <div className="flex items-center gap-2">
            <Input
              id="display-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameSaved(false);
              }}
              disabled={isSavingName}
              className="max-w-xs"
            />
            <Button
              onClick={saveName}
              disabled={!dirty || isSavingName}
              size="sm"
            >
              {isSavingName ? "Saving…" : "Save"}
            </Button>
            {nameSaved && !dirty && (
              <span className="text-xs text-[var(--status-success)]">Saved</span>
            )}
          </div>
          {nameError && (
            <p className="text-xs text-[var(--status-danger)]">{nameError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-display">Email</Label>
          <Input
            id="email-display"
            value={email}
            readOnly
            disabled
            className="max-w-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Password</Label>
          <div>
            <Dialog open={pwOpen} onOpenChange={setPwOpen}>
              <DialogTrigger
                className="rounded-md border border-[var(--border-default)] bg-transparent px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-overlay)]"
              >
                Change password
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change password</DialogTitle>
                  <DialogDescription>
                    Enter a new password at least 8 characters long.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitPassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-new">New password</Label>
                    <Input
                      id="pw-new"
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={isSavingPw}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-confirm">Confirm new password</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={isSavingPw}
                    />
                  </div>
                  {pwError && (
                    <p className="text-xs text-[var(--status-danger)]">{pwError}</p>
                  )}
                  <DialogFooter>
                    <DialogClose
                      render={
                        <Button variant="ghost" type="button" disabled={isSavingPw}>
                          Cancel
                        </Button>
                      }
                    />
                    <Button type="submit" disabled={isSavingPw}>
                      {isSavingPw ? "Saving…" : "Save password"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
