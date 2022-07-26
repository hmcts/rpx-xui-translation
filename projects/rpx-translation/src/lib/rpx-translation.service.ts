import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, from, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { db, Translation } from './db';
import { RpxLanguage } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';

interface TranslationsDTO {
  translations: { [from: string]: string }
}

@Injectable()
export class RpxTranslationService {

  private _currentLanguage: RpxLanguage = 'en'

  private _phrases: { [phrase: string]: BehaviorSubject<string>} = {};
  private _observables: { [phrase: string]: Observable<string>} = {};
  private _requesting: { [lang: string]: string[] } = {};
  private _requestTimerSubscription: Subscription | null;

  public set language(lang: RpxLanguage) {
    if (lang !== this._currentLanguage) {
      this._currentLanguage = lang;
      Object.keys(this._phrases).forEach(phrase => this.translate(phrase));
    }
  }

  public get language(): RpxLanguage {
    return this._currentLanguage;
  }

  constructor(
    private _config: RpxTranslationConfig,
    private _http: HttpClient
  ) { }

  public translate(phrase: string): Observable<string> {
    if (!this._phrases.hasOwnProperty(phrase)) {
      this._phrases[phrase] = new BehaviorSubject<string>(phrase);
      this._observables[phrase] = this._phrases[phrase].asObservable();
    }

    if (this.language === 'en') {
      this._phrases[phrase].next(phrase);
    } else {
      from(liveQuery(() => db.translations.where('[phrase+lang]').equals([phrase, this.language]).first())).pipe(
        tap(t => {
          if (t && !t.isExpired()) {
            this._phrases[phrase].next(t.translation);
          } else {
            if (t) {
              // expired, clean up DB
              db.translations.delete(t.id!);
            }
            this._phrases[phrase].next(`${phrase} [Translation in progress]`);
            this.load(phrase, this.language);
          }
        })
      ).subscribe(() => {});
    }

    return this._observables[phrase];
  }

  private load(phrase: string, lang: RpxLanguage): void {
    if (!this._requesting.hasOwnProperty(lang)) {
      this._requesting[lang] = [];
    }

    if (this._requesting[lang].indexOf(phrase) !== -1) {
      return;
    }

    this._requesting[lang].push(phrase);

    if (this._requestTimerSubscription) {
      this._requestTimerSubscription.unsubscribe();
    }

    this._requestTimerSubscription = timer(this._config.debounceTimeMs).subscribe(() => {
      const url = this._config.baseUrl + `/${lang}`;
      const s = this._http.post<TranslationsDTO>(url, { phrases: this._requesting[lang] }).pipe(
        map(t => t.translations),
        catchError(() => {
          let translations: { [from: string]: string } = {};
          this._requesting[lang].forEach(phrase => translations[phrase] = phrase);
          return of(translations);
        })
      ).subscribe(translations => {
        let toAdd: Translation[] = [];
        Object.keys(translations).forEach(phrase => {
          toAdd.push(Translation.create(phrase, lang, translations[phrase], DateTime.now().plus(this._config.validity).toISO()));
          this._phrases[phrase].next(translations[phrase]);
        });
        db.translations.bulkAdd(toAdd);
        this._requesting[lang] = [];
        this._requestTimerSubscription!.unsubscribe();
        this._requestTimerSubscription = null;
        s.unsubscribe();
      })
    });
  }
}
