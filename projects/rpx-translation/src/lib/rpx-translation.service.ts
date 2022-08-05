import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, from, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { db, Translation } from './db';
import { RpxLanguage } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';

interface TranslationsDTO {
  translations: { [from: string]: string };
}

@Injectable()
export class RpxTranslationService {

  private currentLanguage: RpxLanguage = 'en';

  private phrases: { [phrase: string]: BehaviorSubject<string>} = {};
  private observables: { [phrase: string]: Observable<string>} = {};
  private requesting: { [lang: string]: string[] } = {};
  private requestTimerSubscription: Subscription | null;

  public set language(lang: RpxLanguage) {
    if (lang !== this.currentLanguage) {
      this.currentLanguage = lang;
      Object.keys(this.phrases).forEach(phrase => this.translate(phrase));
    }
  }

  public get language(): RpxLanguage {
    return this.currentLanguage;
  }

  constructor(
    private config: RpxTranslationConfig,
    private http: HttpClient
  ) { }

  public translate(phrase: string): Observable<string> {
    if (!this.phrases.hasOwnProperty(phrase)) {
      this.phrases[phrase] = new BehaviorSubject<string>(phrase);
      this.observables[phrase] = this.phrases[phrase].asObservable();
    }

    if (this.language === 'en') {
      this.phrases[phrase].next(phrase);
    } else {
      from(liveQuery(() => db.translations.where('[phrase+lang]').equals([phrase, this.language]).first())).pipe(
        tap(t => {
          if (t && !t.isExpired()) {
            this.phrases[phrase].next(t.translation);
          } else {
            if (t) {
              // expired, clean up DB
              db.translations.delete(t.id!);
            }
            this.phrases[phrase].next(`${phrase} [Translation in progress]`);
            this.load(phrase, this.language);
          }
        })
      ).subscribe(() => {});
    }

    return this.observables[phrase];
  }

  private load(phrase: string, lang: RpxLanguage): void {
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
          this.requesting[lang].forEach(p => translations[p] = this.config.testMode ?  `[Test translation for ${p}]` : p);
          return of(translations);
        })
      ).subscribe(translations => {
        const toAdd: Translation[] = [];
        Object.keys(translations).forEach(p => {
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
}
