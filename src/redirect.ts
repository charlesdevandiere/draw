/**
 * Root pages: send the browser to its language folder (/draw/en/ or /draw/fr/), where the
 * app is installed with a manifest in that language. `<html data-page>` names the page to
 * open in that folder (the app home by default), e.g. the old /draw/diagnostic.html.
 */
import { pickLanguage } from './i18n/languages';

const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
const language = pickLanguage(tags);
const page = document.documentElement.dataset['page'] ?? '';
window.location.replace(
  `${import.meta.env.BASE_URL}${language}/${page}${window.location.search}${window.location.hash}`,
);
