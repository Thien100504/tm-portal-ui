import { useTheme } from '@/contexts/useTheme';
import { ACCENTS } from '@/contexts/themeConstants';
import {
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Square,
  PenTool,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';

// Utility for classNames
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const {
    mode,
    setMode,
    style,
    setStyle,
    transparency,
    setTransparency,
    blur,
    setBlur,
    motionLevel,
    setMotionLevel,
    motion,
    setMotion,
    mouseGlow,
    setMouseGlow,
    bgGrid,
    setBgGrid,
    accent,
    setAccent,
    radius,
    setRadius,
  } = useTheme();

  const glassOn = style === 'glass';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1.5">
            {t('settings.title')}
          </h1>
          <p className="text-sm text-muted-foreground leading-none">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-sm">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm">{t('settings.appearance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            {/* Theme Mode */}
            <Field label={t('settings.themeMode.title')} hint={t('settings.themeMode.hint')}>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'light', label: t('settings.themeMode.light'), icon: Sun },
                  { value: 'dark', label: t('settings.themeMode.dark'), icon: Moon },
                  { value: 'system', label: t('settings.themeMode.system'), icon: Monitor },
                ]}
              />
            </Field>

            {/* Theme Style */}
            <Field label={t('settings.themeStyle.title')} hint={t('settings.themeStyle.hint')}>
              <Segmented
                value={style}
                onChange={setStyle}
                options={[
                  { value: 'standard', label: t('settings.themeStyle.standard'), icon: Square },
                  { value: 'glass', label: t('settings.themeStyle.glass'), icon: Sparkles },
                  {
                    value: 'sketch',
                    label: t('settings.themeStyle.sketch', { defaultValue: 'Sketch' }),
                    icon: PenTool,
                  },
                ]}
              />
            </Field>

            {/* Glass sliders */}
            <Field
              label={t('settings.transparency.title')}
              hint={t('settings.transparency.hint')}
              disabled={!glassOn}
              value={`${transparency}%`}
            >
              <Slider value={transparency} onChange={setTransparency} disabled={!glassOn} />
            </Field>

            <Field
              label={t('settings.blur.title')}
              hint={t('settings.blur.hint')}
              disabled={!glassOn}
              value={`${blur}%`}
            >
              <Slider value={blur} onChange={setBlur} disabled={!glassOn} />
            </Field>

            <Field
              label={t('settings.radius.title', { defaultValue: 'Border Radius' })}
              hint={t('settings.radius.hint', { defaultValue: 'Adjust corner roundness' })}
              value={`${Math.round((radius / 24) * 100)}%`}
            >
              <Slider value={radius} min={0} max={24} onChange={setRadius} />
            </Field>

            <Field
              label={t('settings.motion.title')}
              hint={t('settings.motion.hint')}
              disabled={!motion}
              value={`${motionLevel}%`}
            >
              <Slider value={motionLevel} onChange={setMotionLevel} disabled={!motion} />
            </Field>

            {/* Motion toggle */}
            <Field
              layout="row"
              label={t('settings.motionToggle.title')}
              hint={t('settings.motionToggle.hint')}
            >
              <Switch checked={motion} onCheckedChange={setMotion} />
            </Field>

            {/* Mouse Glow toggle */}
            <Field
              layout="row"
              label={t('settings.mouseGlow.title')}
              hint={t('settings.mouseGlow.hint')}
            >
              <Switch checked={mouseGlow} onCheckedChange={setMouseGlow} />
            </Field>

            {/* Background Grid toggle */}
            <Field layout="row" label={t('settings.bgGrid.title')} hint={t('settings.bgGrid.hint')}>
              <Switch checked={bgGrid} onCheckedChange={setBgGrid} />
            </Field>

            {/* Accent color */}
            <Field label={t('settings.accent.title')} hint={t('settings.accent.hint')}>
              <div className="flex flex-wrap gap-2">
                {Object.keys(ACCENTS).map((k) => {
                  const a = ACCENTS[k];
                  const active = accent === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setAccent(k)}
                      title={a.label}
                      className={cn(
                        'group flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        active
                          ? 'border-[color:var(--color-ai)]/50 bg-[color:var(--color-ai)]/10 text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span
                        className="size-3.5 rounded-full ring-1 ring-black/10"
                        style={{ background: a.swatch }}
                      />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Live preview */}
        <ThemePreview t={t} />
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component internals
// -------------------------------------------------------------

function Field({ label, hint, children, disabled, value, layout = 'col' }) {
  if (layout === 'row') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 py-1',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="flex-1 pr-4">
          <p className="text-[12.5px] font-medium tracking-tight text-foreground">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{hint}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium tracking-tight text-foreground">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {value && (
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {value}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Slider({ value, onChange, disabled, min = 0, max = 100 }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-6 w-full max-w-[320px]">
      <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-ai), var(--color-ai-soft))',
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]"
      />
    </div>
  );
}

function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-1">
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.value;
        return (
          <button
            key={o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ThemePreview({ t }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[radial-gradient(60%_50%_at_20%_10%,color-mix(in_oklab,var(--color-ai)_22%,transparent),transparent_60%),radial-gradient(50%_40%_at_100%_100%,color-mix(in_oklab,var(--color-ai-soft)_18%,transparent),transparent_60%),var(--color-background)] p-4 h-fit">
      <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t('settings.preview.title')}
      </p>
      <div className="space-y-2.5">
        <div className="glass-surface rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md"
              style={{
                background: 'linear-gradient(135deg, var(--color-ai), var(--color-ai-soft))',
              }}
            />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-foreground">
                {t('settings.preview.sidebar')}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t('settings.preview.sidebarDesc')}
              </p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="glass-surface rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-semibold text-foreground">{t('settings.preview.modal')}</p>
          <p className="text-[10px] text-muted-foreground">{t('settings.preview.modalDesc')}</p>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-md bg-[color:var(--color-ai)] px-2 py-0.5 text-[10px] font-medium text-white">
              {t('settings.preview.primary')}
            </span>
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground">
              {t('settings.preview.secondary')}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-semibold text-foreground">{t('settings.preview.card')}</p>
          <p className="text-[10px] text-muted-foreground">{t('settings.preview.cardDesc')}</p>
        </div>
      </div>
    </div>
  );
}
