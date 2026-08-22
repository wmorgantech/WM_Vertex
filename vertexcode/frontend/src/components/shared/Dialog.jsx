import {
  Dialog as UiDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function Dialog({ open = true, title, onClose, children, footer, className }) {
  return (
    <UiDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </UiDialog>
  );
}
