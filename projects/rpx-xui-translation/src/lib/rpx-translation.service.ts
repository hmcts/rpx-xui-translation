import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, from, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { db, Translation } from './db';
import { RpxLanguage, YesOrNoValue } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';
import { TranslatedData } from './models/translated-data.model';
import { replacePlaceholders } from './helpers/replace-placeholders/replace-placeholders.helper';
import { matchCase } from './helpers/match-case/match-case.helper';

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
      map((t) => t.phrase)
    );
  }

  public getTranslationWithReplacements$(phrase: string, replacements: Replacements): Observable<string> {
    return this.getTranslatedData(phrase).pipe(
      map((translatedData) => replacePlaceholders(translatedData.phrase, replacements))
    );
  }

  public getTranslationWithYesOrNo$(phrase: string, yesOrNoValue: string): Observable<string> {
    const isYes = yesOrNoValue?.toLowerCase() === YesOrNoValue.YES.toLowerCase();
    const isNo = yesOrNoValue?.toLowerCase() === YesOrNoValue.NO.toLowerCase();

    return this.getTranslatedData(phrase).pipe(map((translatedData) => {
      const yesOrNoTranslated = (isYes ? (translatedData.yes || yesOrNoValue) : yesOrNoValue) ||
        (isNo ? (translatedData.no || yesOrNoValue) : yesOrNoValue);
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
      this.phrases[phrase] = new BehaviorSubject<TranslatedData>({ phrase });
      this.observables[phrase] = this.phrases[phrase].asObservable();
    }

    if (lang === 'en') {
      this.phrases[phrase].next({ phrase });
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
              phrase: `${phrase} [Translation in progress]`,
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
        phrase,
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
              if (typeof (translations[p]) === 'string') {
                translatedData[p] = { phrase: translations[p] as string };
              } else {
                translatedData[p] = translations[p] as TranslatedData;
              }
            });

            return translatedData;
          }),
          catchError(() => {
            const translations: { [from: string]: TranslatedData } = {};
            this.requesting[lang].forEach((p) => (
              translations[p] = this.config.testMode ? { phrase: `[Test translation for ${p}]` } : { phrase: p })
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
          this.requestTimerSubscription!.unsubscribe();
          this.requestTimerSubscription = null;
          s.unsubscribe();
        });
    });
  }

  private persistLanguage(): void {
    document.cookie = `${this.languageKey}=${this.currentLanguage};`;
  }

  private getPersistedLanguage(): RpxLanguage {
    return document.cookie.split(';').find((cookie) => cookie.trim().startsWith(this.languageKey + '='))?.split('=')[1].trim() as RpxLanguage;
  }
}
