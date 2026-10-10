import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Confirmation dialog that requires typing a word to confirm destructive actions.
 *
 * @param {boolean} isOpen - show/hide
 * @param {function} onClose - cancel callback
 * @param {function} onConfirm - execute delete callback
 * @param {string} title - dialog title (e.g. "Delete task")
 * @param {string} description - custom description per resource
 * @param {string} [confirmWord="delete"] - word user must type to confirm
 * @param {boolean} [isDeleting=false] - loading state
 * @param {string} [confirmLabel] - submit button label (default: title)
 */
export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmWord = 'delete',
  isDeleting = false,
  confirmLabel,
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (isOpen) setInput('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = input.toLowerCase().trim() === confirmWord.toLowerCase();

  return (
    <Modal
      title={title}
      icon={<AlertTriangle className="w-4 h-4 text-[color:var(--color-destructive)]" />}
      onClose={onClose}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isDeleting}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!isMatch || isDeleting}
            onClick={onConfirm}
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel || title}
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <p className="text-[13px] text-foreground leading-relaxed">
          {description}
        </p>

        <div className="bg-[color:var(--color-destructive)]/5 border border-[color:var(--color-destructive)]/20 rounded-lg p-3">
          <p className="text-[12px] text-[color:var(--color-destructive)] font-medium">
            {t('common.action_cannot_undo', { defaultValue: 'This action cannot be undone. Type ' })}
            <code className="bg-[color:var(--color-destructive)]/10 px-1.5 py-0.5 rounded font-mono font-bold mx-1">{confirmWord}</code>
            {t('common.to_confirm', { defaultValue: 'to confirm.' })}
          </p>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmWord}
          autoFocus
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[color:var(--color-destructive)] focus:ring-1 focus:ring-[color:var(--color-destructive)] transition-all"
        />
      </div>
    </Modal>
  );
}
