import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User as UserIcon, Mail, Shield, Save, Loader2, Camera } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import userService from '@/services/userService';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-foreground">{label}</label>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({ ...prev, full_name: user.full_name || '' }));
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      // Validate password match
      if (data.password && data.password !== data.confirm_password) {
        throw new Error(t('profile.password_mismatch', { defaultValue: 'Passwords do not match' }));
      }

      const payload = { full_name: data.full_name };
      if (data.password) {
        payload.password = data.password;
      }
      return await userService.updateMe(payload);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setFormData((prev) => ({ ...prev, password: '', confirm_password: '' }));
      toast.success(t('profile.update_success', { defaultValue: 'Profile updated successfully' }));
    },
    onError: (error) => {
      toast.error(
        error.message || t('profile.update_error', { defaultValue: 'Failed to update profile' })
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
          <UserIcon className="w-6 h-6" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1.5">
            {t('profile.title', { defaultValue: 'Personal Profile' })}
          </h1>
          <p className="text-sm text-muted-foreground leading-none">
            {t('profile.subtitle', {
              defaultValue: 'Manage your personal information and security',
            })}
          </p>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
              {t('profile.basic_info', { defaultValue: 'Basic Information' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            <div className="flex items-center gap-6 pb-4 border-b border-border/50">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)]/20 to-[color:var(--color-ai)]/20 flex items-center justify-center border-2 border-border text-2xl font-bold text-foreground">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <button
                  type="button"
                  className="absolute inset-0 bg-background/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-foreground"
                >
                  <Camera className="w-4 h-4" />
                  Upload
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{user?.full_name}</p>
                <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Mail className="w-3.5 h-3.5" /> {user?.email}
                </p>
              </div>
            </div>

            <Field label={t('profile.full_name', { defaultValue: 'Full Name' })}>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
              />
            </Field>

            <Field
              label={t('profile.email', { defaultValue: 'Email Address' })}
              hint={t('profile.email_hint', { defaultValue: 'Email cannot be changed.' })}
            >
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-[13px] text-muted-foreground cursor-not-allowed"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              {t('profile.security', { defaultValue: 'Security' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            <Field
              label={t('profile.new_password', { defaultValue: 'New Password' })}
              hint={t('profile.password_hint', {
                defaultValue: 'Leave blank to keep current password.',
              })}
            >
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
              />
            </Field>

            {formData.password && (
              <Field
                label={t('profile.confirm_password', { defaultValue: 'Confirm New Password' })}
              >
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required={!!formData.password}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
                />
              </Field>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" disabled={updateMutation.isPending} className="min-w-[120px]">
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('common.save_changes', { defaultValue: 'Save Changes' })}
          </Button>
        </div>
      </form>
    </div>
  );
}
