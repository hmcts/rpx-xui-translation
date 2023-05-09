import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, from, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { db, Translation } from './db';
import { RpxLanguage, YesOrNoValue } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';
import { TranslationModel } from './translation.model';

interface TranslationsDTO {
  translations: { [from: string]: TranslationModel };
}

export type Replacements = { [key: string]: string };

@Injectable()
export class RpxTranslationService {

  private currentLanguage: RpxLanguage = 'en';
  private languageKey = 'exui-preferred-language';

  private phrases: { [phrase: string]: BehaviorSubject<string> } = {};
  private observables: { [phrase: string]: Observable<string> } = {};
  private requesting: { [lang: string]: string[] } = {};
  private requestTimerSubscription: Subscription | null;
  private languageSource: BehaviorSubject<RpxLanguage> = new BehaviorSubject<RpxLanguage>(this.currentLanguage);
  public language$: Observable<RpxLanguage>;

  public set language(lang: RpxLanguage) {
    if (lang !== this.currentLanguage) {
      this.currentLanguage = lang;
      this.persistLanguage();
      this.languageSource.next(lang);
      Object.keys(this.phrases).forEach(phrase => this.translate(phrase));
    }
  }

  public get language(): RpxLanguage {
    return this.currentLanguage;
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

  public getTranslation(phrase: string, yesOrNo?: string): Observable<string> {
    if (this.observables.hasOwnProperty(phrase) && !yesOrNo?.length) {
      return this.observables[phrase];
    }

    return this.translate(phrase, yesOrNo);
  }

  public getTranslationWithReplacements(phrase: string, replacements: Replacements): Observable<string> {
    return this.getTranslation(phrase).pipe(
      map(translation => this.replacePlaceholders(translation, replacements))
    );
  }

  public getYesOrNoTranslationReplacement(phrase: string, yesOrNoValue: string): Observable<string> {
    return this.getTranslation(`${phrase}_${yesOrNoValue}`, yesOrNoValue);
  }

  getPhrase(model: TranslationModel, yesOrNoValue: string | undefined): any {
    if (yesOrNoValue === YesOrNoValue.YES) {
      return model?.yes ? model.yes : YesOrNoValue.YES;
    } else if (yesOrNoValue === YesOrNoValue.NO) {
      return model?.no ? model.no : YesOrNoValue.NO;
    }
    return model?.phrase ? model.phrase : model;
  }

  public translate(phrase: string, yesOrNo?: string): Observable<string> {
    const lang = this.language;
    if (!this.phrases.hasOwnProperty(phrase)) {
      this.phrases[phrase] = new BehaviorSubject<string>(phrase);
      this.observables[phrase] = this.phrases[phrase].asObservable();
    }

    if (lang === 'en') {
      if (yesOrNo?.length) {
        this.phrases[phrase].next(yesOrNo === YesOrNoValue.YES ? YesOrNoValue.YES : YesOrNoValue.NO);
      } else {
        this.phrases[phrase].next(phrase);
      }
    } else {
      from(liveQuery(() => db.translations.where('[phrase+lang]').equals([phrase, lang]).first())).pipe(
        tap(t => {
          if (t && !t.isExpired()) {
            this.phrases[phrase].next(this.getPhrase(t.translation, yesOrNo));
          } else {
            if (t) {
              // expired, clean up DB
              db.translations.delete(t.id!);
            }
            this.phrases[phrase].next(`${phrase} [Translation in progress]`);
            this.load(phrase, lang, yesOrNo);
          }
        })
      ).subscribe(() => { });
    }

    return this.observables[phrase];
  }

  public replacePlaceholders(input: string, replacements: Replacements): string {
    Object.keys(replacements).forEach(key => {
      // Ideally use replaceAll here, but that isn't fully compatible with targeted browsers and packaging yet
      const search = `%${key}%`;
      while (input.indexOf(search) !== -1) {
        input = input.replace(search, replacements[key]);
      }
    });
    return input;
  }

  private load(phrase: string, lang: RpxLanguage, yesOrNo: string | undefined): void {
    if (lang === 'en') {
      this.phrases[phrase].next(phrase);
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
      const s = this.http.post<TranslationsDTO>(url, { phrases: this.requesting[lang] }).pipe(
        map(t => t.translations),
        catchError(() => {
          const translations: { [from: string]: string } = {};
          this.requesting[lang].forEach(p => translations[p] = this.config.testMode ? `[Test translation for ${p}]` : p);
          return of(translations);
        })
      ).subscribe((translations: { [from: string]: TranslationModel }) => {
        const toAdd: Translation[] = [];
        Object.keys(translations).forEach(p => {
          toAdd.push(Translation.create(p, lang, translations[p], DateTime.now().plus(this.config.validity).toISO()));
          this.phrases[p].next(this.getPhrase(translations[p], yesOrNo));
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
    return document.cookie.split(';').find(cookie => cookie.trim().startsWith(this.languageKey + '='))?.split('=')[1].trim() as RpxLanguage;
  }
}
