import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, combineLatest, from, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { db, Translation } from './db';
import { matchCase } from './helpers/match-case/match-case.helper';
import { splitPhraseIntoComponents } from './helpers/replace-placeholders/replace-placeholders.helper';
import { TranslatedData } from './models/translated-data.model';
import { RpxLanguage, YesOrNoValue } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';

interface TranslationsDTO {
  translations: { [from: string]: string | TranslatedData };
}

export type Replacements = { [key: string]: string };

@Injectable()
export class RpxTranslationService {
  private currentLanguage: RpxLanguage = 'en';
  private languageKey = 'exui-preferred-language';

  private phrases: { [phrase: string]: BehaviorSubject<TranslatedData> } = {};
  private observables: { [phrase: string]: Observable<TranslatedData> } = {};
  private requesting: { [lang: string]: string[] } = {};
  private requestTimerSubscription: Subscription | null;
  private languageSource: BehaviorSubject<RpxLanguage> = new BehaviorSubject<RpxLanguage>(this.currentLanguage);
  public language$: Observable<RpxLanguage>;

  public get language(): RpxLanguage {
    return this.currentLanguage;
  }

  public set language(lang: RpxLanguage) {
    if (lang !== this.currentLanguage) {
      this.currentLanguage = lang;
      this.persistLanguage();
      this.languageSource.next(lang);
      Object.keys(this.phrases).forEach((phrase) => this.translate(phrase));
    }
  }

  constructor(
    private config: RpxTranslationConfig,
    private http: HttpClient
  ) {
    const persistedLanguage = this.getPersistedLanguage();
    if (persistedLanguage) {
      this.language = persistedLanguage;
    } else {
      // no language persisted yet, save default
      this.persistLanguage();
    }
    this.language$ = this.languageSource.asObservable();
  }

  public getTranslation$(phrase: string): Observable<string> {
    return this.getTranslatedData(phrase).pipe(
      map((t) => t.translation)
    );
  }

  public getTranslationWithReplacements$(phrase: string, replacements: Replacements): Observable<string> {
    // Split the phrase into components first based on replacements
    const components = splitPhraseIntoComponents(phrase, replacements);

    // Translate each component individually using getTranslatedData and then combine them
    const translatedComponents$ = components.map((component) => this.getTranslatedData(component).pipe(
      map((translatedData) => translatedData.translation) // Extract the translated string
    ));

    return combineLatest(translatedComponents$).pipe(
      map((values: string[]) => values.join('')) // Join the strings without any separator
    );
  }

  public getTranslationWithYesOrNo$(phrase: string, yesOrNoValue: string): Observable<string> {
    const isYes = yesOrNoValue?.toLowerCase() === YesOrNoValue.YES.toLowerCase();

    return this.getTranslatedData(phrase).pipe(map((translatedData: TranslatedData) => {
      const yesOrNoTranslated = isYes ? (translatedData.yes || yesOrNoValue)
        : (translatedData.no || yesOrNoValue);
      return matchCase(yesOrNoValue!, yesOrNoTranslated);
    }
    ));
  }

  private getTranslatedData(phrase: string): Observable<TranslatedData> {
    if (this.observables.hasOwnProperty(phrase)) {
      return this.observables[phrase];
    }

    return this.translate(phrase);
  }

  private translate(phrase: string): Observable<TranslatedData> {
    const lang = this.language;
    if (!this.phrases.hasOwnProperty(phrase)) {
      this.phrases[phrase] = new BehaviorSubject<TranslatedData>({ translation: phrase });
      this.observables[phrase] = this.phrases[phrase].asObservable();
    }

    if (lang === 'en') {
      this.phrases[phrase].next({ translation: phrase });
    } else {
      from(liveQuery(() => db.translations.where('[phrase+lang]').equals([phrase, lang]).first())).pipe(
        tap((t) => {
          if (t && !t.isExpired()) {
            this.phrases[phrase].next(t.translation);
          } else {
            if (t) {
              // expired, clean up DB
              db.translations.delete(t.id!);
            }
            this.phrases[phrase].next({
              translation: `${phrase} [Translation in progress]`,
              yes: 'Yes [Translation in progress]',
              no: 'No [Translation in progress]'
            });
            this.load(phrase, lang);
          }
        }),
      ).subscribe(() => ({}));
    }

    return this.observables[phrase];
  }

  private load(phrase: string, lang: RpxLanguage): void {
    if (lang === 'en') {
      this.phrases[phrase].next({
        translation: phrase,
        yes: 'Yes',
        no: 'No'
      });
      return;
    }

    if (!this.requesting.hasOwnProperty(lang)) {
      this.requesting[lang] = [];
    }

    if (this.requesting[lang].indexOf(phrase) !== -1) {
      return;
    }

    // Prevent making a API call with empty array of phrase
    if (phrase.length === 0) {
      return;
    }

    this.requesting[lang].push(phrase);

    if (this.requestTimerSubscription) {
      this.requestTimerSubscription.unsubscribe();
    }

    this.requestTimerSubscription = timer(this.config.debounceTimeMs).subscribe(() => {
      const url = this.config.baseUrl + `/${lang}`;
      const s = this.http.post<TranslationsDTO>(url,
        {
          phrases: this.requesting[lang]
        }
      )
        .pipe(
          map((t) => t.translations),
          map((translations) => {
            const translatedData: { [from: string]: TranslatedData } = {};

            Object.keys(translations).forEach((p) => {
              if (typeof(translations[p]) === 'string') {
                translatedData[p] = { translation: translations[p] as string };
              } else {
                translatedData[p] = translations[p] as TranslatedData;
              }
            });

            return translatedData;
          }),
          catchError(() => {
            const translations: { [from: string]: TranslatedData } = {};
            this.requesting[lang].forEach((p) => (
              translations[p] = this.config.testMode ? { translation: `[Test translation for ${p}]` } : { translation: p })
            );
            return of(translations);
          })
        ).subscribe((translations: { [from: string]: TranslatedData }) => {
          const toAdd: Translation[] = [];
          Object.keys(translations).forEach((p) => {
            toAdd.push(Translation.create(p, lang, translations[p], DateTime.now().plus(this.config.validity).toISO()));
            this.phrases[p].next(translations[p]);
          });
          db.translations.bulkAdd(toAdd);
          this.requesting[lang] = [];
          this.requestTimerSubscription?.unsubscribe();
          this.requestTimerSubscription = null;
          s.unsubscribe();
        });
    });
  }

  private persistLanguage(): void {
    document.cookie = `${this.languageKey}=${this.currentLanguage}; SameSite=Strict;`;
  }

  private getPersistedLanguage(): RpxLanguage {
    console.log(document.cookie.split(';').find((cookie) => cookie.trim().startsWith(this.languageKey + '='))?.split('=')[1].trim())
    return document.cookie.split(';').find((cookie) => cookie.trim().startsWith(this.languageKey + '='))?.split('=')[1].trim() as RpxLanguage;
  }
}
