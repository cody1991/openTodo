import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import './LangSelect.css';

export default function LangSelect({ className = '' }) {
  return (
    <select
      className={`lang-select${className ? ` ${className}` : ''}`}
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>{lang.label}</option>
      ))}
    </select>
  );
}
