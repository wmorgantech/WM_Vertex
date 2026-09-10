import {
  Dialog as UiDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// bodyClassName is optional and defaults to no extra classes — every
// existing caller that doesn't pass it renders exactly as before. It exists
// so a caller with a taller/wider dialog (e.g. AdminDocumentReview's
// document list) can make its own content area flex-fill and scroll
// independently of the header, instead of nesting a second fixed-height
// scroll region inside DialogContent's own.
export default function Dialog({ open = true, title, onClose, children, footer, className, bodyClassName }) {
  return (
    <UiDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={bodyClassName}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </UiDialog>
  );
}
