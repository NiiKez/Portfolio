'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

type Scope = 'local' | 'global';

/**
 * Account security actions for the signed-in admin.
 *
 * The sidebar/nav "Logout" uses Supabase's default (`global`) scope, which
 * revokes the refresh token everywhere. Here we expose both ends explicitly:
 * sign out only this device (`local`) or revoke every active session
 * (`global`). The global path is destructive enough to sit behind a confirm.
 */
export function AccountSecurity() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingScope, setPendingScope] = useState<Scope | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function signOut(scope: Scope) {
    setPendingScope(scope);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope });

      if (error) {
        toast.error(`Could not sign out: ${error.message}`);
        setPendingScope(null);
        return;
      }

      toast.success(
        scope === 'global'
          ? 'Signed out of all devices.'
          : 'Signed out on this device.',
      );
      setConfirmOpen(false);
      router.replace('/admin/login');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Sessions</p>
        <p className="text-sm text-muted-foreground">
          End this session, or revoke every device signed in to your account.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => signOut('local')}
          disabled={isPending}
        >
          <LogOut />
          {isPending && pendingScope === 'local'
            ? 'Signing out…'
            : 'Sign out this device'}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
          >
            <ShieldAlert />
            Sign out everywhere
          </Button>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign out of all devices?</DialogTitle>
              <DialogDescription>
                This revokes every active session for your account. You&apos;ll
                need a fresh magic link to sign back in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" disabled={isPending} />}
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => signOut('global')}
                disabled={isPending}
              >
                {isPending && pendingScope === 'global'
                  ? 'Signing out…'
                  : 'Sign out everywhere'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
