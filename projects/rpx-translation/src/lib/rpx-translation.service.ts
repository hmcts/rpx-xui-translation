import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { DateTime } from 'luxon';
import { BehaviorSubject, from, Observable, of, Subscription, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { db, Translation } from './db';
import { RpxLanguage } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';

interface TranslationsDTO {
  translations: { [from: string]: string }
}

@Injectable()
export class RpxTranslationService {

  private _currentLanguage: RpxLanguage = RpxLanguage.en

  private _phrases: { [phraseLang: string]: BehaviorSubject<string>} = {};
  private _requesting: { [lang: string]: string[] } = {};
  private _requestTimerSubscription: Subscription | null;

  public set language(lang: RpxLanguage) {
    this._currentLanguage = lang;
  }

  public get language(): RpxLanguage {
    return this._currentLanguage;
  }

  constructor(
    private _config: RpxTranslationConfig,
    private _http: HttpClient
  ) { }

  public translate(phrase: string): Observable<string> {
    if (this.language === RpxLanguage.en) {
      return of(phrase);
    }
    return from(liveQuery(() => db.translations.where('[phrase+lang]').equals([phrase, this._currentLanguage]).first())).pipe(
      switchMap(t => {
        if (t && !t.isExpired()) {
          return of(t.translation);
        } else {
          if (t) {
            // is expired, so clean up DB
            db.translations.delete(t.id!);
          }
          return this.load(phrase, this._currentLanguage);
        }
      })
    );
  }

  private load(phrase: string, lang: RpxLanguage): Observable<string> {
    const key = `$phrase-$lang`;
    if (!this._phrases.hasOwnProperty(key)) {
      this._phrases[key] = new BehaviorSubject(phrase);
      if (!this._requesting.hasOwnProperty(lang)) {
        this._requesting[lang] = [];
      }
      this._requesting[lang].push(phrase);
      if (this._requestTimerSubscription) {
        // cancel the current subscription and create a new one to restart the timer before we make the request (debouncing)
        this._requestTimerSubscription.unsubscribe();
      }
      this._requestTimerSubscription = timer(this._config.debounceTimeMs).subscribe(() => {
        const url = this._config.baseUrl + `/$lang`;
        const s = this._http.post<TranslationsDTO>(url, { phrases: this._requesting[lang] }).pipe(
          map(t => t.translations)
        ).subscribe(translations => {
          let toAdd: Translation[] = [];
          Object.keys(translations).forEach(phrase => {
            toAdd.push(Translation.create(phrase, lang, translations[phrase], DateTime.now().plus(this._config.validity).toISO()));
            this._phrases[key].next(translations[phrase]);
          });
          db.translations.bulkAdd(toAdd);
          this._requesting[lang] = [];
          this._requestTimerSubscription!.unsubscribe();
          this._requestTimerSubscription = null;
          s.unsubscribe();
        });
      });
    }
    return this._phrases[key].asObservable();
  }
}
