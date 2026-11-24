import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import {
  User as UserIcon,
  Mail,
  Lock,
  UserPlus,
  ArrowLeft,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/useTheme';
import MouseGlowBackground from '@/components/MouseGlowBackground';
import { Button } from '@/components/ui/Button';
import { getApiError } from '@/lib/apiError';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { registerAsync } = useAuth();
  const { theme, toggleTheme, themeStyle } = useTheme();
  const { t, i18n } = useTranslation();
  const [globalError, setGlobalError] = useState('');
  const isGlass = themeStyle === 'glass';

  const registerSchema = z
    .object({
      full_name: z.string().min(2, { message: t('auth.fullname_min') }),
      email: z.string().email({ message: t('auth.invalid_email') }),
      password: z
        .string()
        .min(8, { message: t('auth.password_min_8') })
        .regex(/[A-Z]/, { message: t('auth.password_uppercase') })
        .regex(/\d/, { message: t('auth.password_number') }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.password_mismatch'),
      path: ['confirmPassword'],
    });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      setGlobalError('');
      await registerAsync({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      });
      // Redirect to login after successful registration
      navigate('/login', { state: { message: t('auth.register_success_msg') } });
    } catch (error) {
      setGlobalError(getApiError(error, t('auth.register_error_fallback')));
    }
  };

  return (
    <MouseGlowBackground>
      {/* Top right floating toggles */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="absolute top-6 right-6 z-50 flex items-center gap-3"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
          className={`w-9 h-9 text-[11px] font-bold uppercase transition-all shadow-sm ${isGlass ? 'bg-card/50 backdrop-blur-md' : 'bg-card'}`}
          title="Change language"
        >
          {i18n.language === 'vi' ? 'VI' : 'EN'}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className={`w-9 h-9 transition-all shadow-sm ${isGlass ? 'bg-card/50 backdrop-blur-md' : 'bg-card'}`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
        className={`w-full max-w-md border border-border shadow-2xl rounded-2xl p-8 relative z-10 ${
          isGlass ? 'bg-card/80 backdrop-blur-xl' : 'bg-card'
        }`}
      >
        <div className="flex justify-center mb-6">
          <div className="bg-[color:var(--color-primary)]/10 p-3 rounded-xl border border-[color:var(--color-primary)]/20 shadow-inner">
            <Sparkles className="w-8 h-8 text-[color:var(--color-primary)]" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1.5">
            {t('auth.register_title')}
          </h1>
          <p className="text-[13px] text-muted-foreground font-medium">
            {t('auth.register_subtitle')}
          </p>
        </div>

        {globalError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-[color:var(--color-destructive)]/10 text-[color:var(--color-destructive)] p-3 rounded-lg text-xs font-medium mb-6 border border-[color:var(--color-destructive)]/20 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-destructive)] flex-shrink-0" />
            {globalError}
          </motion.div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t('auth.fullname')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <input
                type="text"
                {...register('full_name')}
                className={`block w-full pl-9 pr-3 py-2 text-[13px] bg-background border ${
                  errors.full_name
                    ? 'border-[color:var(--color-destructive)] focus:ring-[color:var(--color-destructive)]'
                    : 'border-border focus:ring-[color:var(--color-primary)]'
                } rounded-lg focus:outline-none focus:ring-1 text-foreground transition-all placeholder:text-muted-foreground/50`}
                placeholder={t('auth.fullname_placeholder')}
              />
            </div>
            {errors.full_name && (
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-destructive)]">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t('auth.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <input
                type="email"
                {...register('email')}
                className={`block w-full pl-9 pr-3 py-2 text-[13px] bg-background border ${
                  errors.email
                    ? 'border-[color:var(--color-destructive)] focus:ring-[color:var(--color-destructive)]'
                    : 'border-border focus:ring-[color:var(--color-primary)]'
                } rounded-lg focus:outline-none focus:ring-1 text-foreground transition-all placeholder:text-muted-foreground/50`}
                placeholder={t('auth.email_placeholder')}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-destructive)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t('auth.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <input
                type="password"
                {...register('password')}
                className={`block w-full pl-9 pr-3 py-2 text-[13px] bg-background border ${
                  errors.password
                    ? 'border-[color:var(--color-destructive)] focus:ring-[color:var(--color-destructive)]'
                    : 'border-border focus:ring-[color:var(--color-primary)]'
                } rounded-lg focus:outline-none focus:ring-1 text-foreground transition-all placeholder:text-muted-foreground/50`}
                placeholder={t('auth.password_placeholder')}
              />
            </div>
            {errors.password && (
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-destructive)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t('auth.confirm_password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <input
                type="password"
                {...register('confirmPassword')}
                className={`block w-full pl-9 pr-3 py-2 text-[13px] bg-background border ${
                  errors.confirmPassword
                    ? 'border-[color:var(--color-destructive)] focus:ring-[color:var(--color-destructive)]'
                    : 'border-border focus:ring-[color:var(--color-primary)]'
                } rounded-lg focus:outline-none focus:ring-1 text-foreground transition-all placeholder:text-muted-foreground/50`}
                placeholder={t('auth.password_placeholder')}
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-destructive)]">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full mt-4">
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                {t('auth.register_button')}
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[12px] text-muted-foreground">
          <Link
            to="/login"
            className="font-semibold text-foreground hover:text-[color:var(--color-primary)] inline-flex items-center group transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 transform group-hover:-translate-x-1 transition-transform" />
            {t('auth.has_account')}
          </Link>
        </div>
      </motion.div>
    </MouseGlowBackground>
  );
}
