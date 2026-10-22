import en from './locales/en.mjs';
import ko from './locales/ko.mjs';
import ja from './locales/ja.mjs';
import zh from './locales/zh.mjs';
import es from './locales/es.mjs';
import fr from './locales/fr.mjs';
import de from './locales/de.mjs';

export const dictionaries=Object.freeze({en,ko,ja,zh,es,fr,de});
export const languageOptions=Object.freeze([
  {code:'en',label:'English'}, {code:'ko',label:'한국어'},
  {code:'ja',label:'日本語'}, {code:'zh',label:'简体中文'},
  {code:'es',label:'Español'}, {code:'fr',label:'Français'},
  {code:'de',label:'Deutsch'}
]);
export const supported=Object.freeze(languageOptions.map(({code})=>code));

export function resolveLocale(saved,system='en'){
  const valid=(value)=>{
    if(typeof value!=='string')return null;
    const raw=value.trim().replaceAll('_','-').toLowerCase();
    const primary=raw.split('-')[0];
    return supported.includes(raw)?raw:supported.includes(primary)?primary:null;
  };
  return valid(saved)||valid(system)||'en';
}
export function translate(locale,key,params={}){
  const value=dictionaries[resolveLocale(locale)]?.[key]??dictionaries.en[key];
  if(typeof value!=='string')throw Error('Missing i18n key: '+key);
  return value.replace(/\{([a-z][a-zA-Z0-9]*)\}/g,(match,name)=>{
    const v=params[name];
    return v===undefined||v===null?match:String(v);
  });
}
