/**
 * Root page: sends the browser to its language folder (/draw/en/ or /draw/fr/), where the
 * app is installed with a manifest in that language.
 */
import { pickLanguage } from './i18n/languages';

const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
const language = pickLanguage(tags);
window.location.replace(
  `${import.meta.env.BASE_URL}${language}/${window.location.search}${window.location.hash}`,
);
