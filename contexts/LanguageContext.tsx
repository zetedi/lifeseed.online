
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { translations, Language } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Fix: Marking children as optional to avoid TypeScript errors in some environments 
// where children nested in JSX are not immediately recognized as the 'children' prop.
export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
      const stored = localStorage.getItem('lifeseed_lang');
      if (stored && translations[stored as Language]) {
          setLanguageState(stored as Language);
      }
  }, []);

  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('lifeseed_lang', lang);
  }

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key];
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
