import { useState } from 'react';
import { Settings, Mail, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MaintenancePage() {
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Settings className="size-8" />
        </span>

        <h1 className="text-xl font-semibold text-foreground">Server is under maintenance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re working hard to improve the user experience. Stay tuned!
        </p>

        <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setShowContact((v) => !v)}>
            <Mail /> Contact Us
          </Button>
          <Button type="button" onClick={() => window.location.reload()}>
            <RotateCw /> Reload
          </Button>
        </div>

        {showContact && (
          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-left text-sm text-muted-foreground">
            We&apos;re already aware of this and are working to bring things back online. Please
            try the Reload button again shortly — no need to report this separately.
          </div>
        )}
      </div>
    </div>
  );
}
