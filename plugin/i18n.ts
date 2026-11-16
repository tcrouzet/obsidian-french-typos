import en from '../locales/en.json';
import fr from '../locales/fr.json';

const messages = { en, fr };
type Locale = keyof typeof messages;
let locale: Locale = 'en';

export function setLocale(language: string): void {
	const base = language.toLowerCase().replace(/_/g, '-').split('-')[0];
	locale = base === 'fr' ? 'fr' : 'en';
}

export function t(key: keyof typeof en, parameters: Record<string, string | number> = {}): string {
	return (messages[locale][key] ?? en[key]).replace(/\{(\w+)\}/g, (_match, name: string) => {
		const value = parameters[name];
		return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
	});
}
