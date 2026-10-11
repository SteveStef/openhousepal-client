import { Moon, Sun } from 'lucide-react';

// Two-sided sun|moon switch - the lit side is the sign-in screen's current theme, so the state is
// readable at a glance instead of from a single icon.
export default function ThemeSwitch({ dark, small = false }: { dark: boolean; small?: boolean }) {
  // Card size steps with the Documents card's width (narrowest at sm) so switch + info always fit.
  const knob = small ? 'h-4 w-4 sm:h-3.5 sm:w-3.5 md:h-[18px] md:w-[18px] lg:h-5 lg:w-5' : 'h-5 w-5';
  const icon = small ? 10 : 11;
  return (
    <span className={`flex shrink-0 items-center gap-0.5 rounded-full p-[2px] ${dark ? (small ? 'bg-gray-800 dark:bg-white/15' : 'bg-white/15') : small ? 'bg-gray-200 dark:bg-white/10' : 'bg-gray-200'}`}>
      <span className={`flex ${knob} items-center justify-center rounded-full ${dark ? 'text-white/40' : 'bg-amber-400 text-white'}`}><Sun size={icon} strokeWidth={3} /></span>
      <span className={`flex ${knob} items-center justify-center rounded-full ${dark ? 'bg-white text-black' : 'text-gray-400'}`}><Moon size={icon} strokeWidth={3} /></span>
    </span>
  );
}
