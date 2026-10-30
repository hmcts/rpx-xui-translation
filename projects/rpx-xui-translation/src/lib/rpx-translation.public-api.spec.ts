import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { db } from './db';
import { TranslatedData } from './models/translated-data.model';
import { RpxTranslationService } from './rpx-translation.service';

type TranslationReply = { translations: Record<string, string | TranslatedData> };
type TranslationRequest = { url: string; body: unknown; reply: Subject<TranslationReply> };

const yesOrNoInputs = ['Yes', 'yes', 'No', 'no'];

describe('RpxTranslationService public API composition', () => {
  let service: RpxTranslationService;
  let requests: Subject<TranslationRequest>;
  let post: jasmine.Spy<(url: string, body: unknown) => Subject<TranslationReply>>;
  let subscriptions: Subscription[];
  let replies: Subject<TranslationReply>[];

  beforeEach(() => {
    document.cookie = 'exui-preferred-language=; Max-Age=0; SameSite=Strict;';
    requests = new Subject<TranslationRequest>();
    subscriptions = [];
    replies = [];
    post = jasmine.createSpy<(url: string, body: unknown) => Subject<TranslationReply>>('post').and.callFake((url, body) => {
      const reply = new Subject<TranslationReply>();
      replies.push(reply);
      requests.next({ url, body: structuredClone(body), reply });
      return reply;
    });
    // Only cache misses and HTTP delivery are faked; the public composition methods and helpers stay real.
    spyOn(db.translations, 'where').and.returnValue({
      equals: () => ({ first: () => Promise.resolve(undefined) })
    } as unknown as ReturnType<typeof db.translations.where>);
    spyOn(db.translations, 'bulkAdd').and.stub();
    service = new RpxTranslationService(
      { baseUrl: '/translations', debounceTimeMs: 20, validity: { days: 1 }, testMode: false },
      { post } as unknown as HttpClient
    );
    service.language = 'cy';
  });

  afterEach(() => {
    service.language = 'en';
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    replies.forEach((reply) => reply.complete());
    requests.complete();
    document.cookie = 'exui-preferred-language=; Max-Age=0; SameSite=Strict;';
  });

  it('translates only static fragments and preserves repeated numeric replacements and spacing', async () => {
    const pending = firstValueFrom(requests);
    const values: string[] = [];
    subscriptions.push(service.getTranslationWithReplacements$(
      '  Case %NUMBER% has %NUMBER% updates  ', { NUMBER: ' 1234 ' }
    ).subscribe((value) => values.push(value)));

    const request = await pending;
    expect(request.url).toBe('/translations/cy');
    expect(request.body).toEqual({ phrases: ['Case', 'has', 'updates'] });
    expect(post).toHaveBeenCalledTimes(1);
    request.reply.next({ translations: { Case: 'Achos', has: 'gyda', updates: 'diweddariadau' } });

    expect(values.at(-1)).toBe('Achos 1234 gyda 1234 diweddariadau');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('selects Yes/No metadata and matches each input’s initial letter case from one request', async () => {
    const phrase = 'Do you agree?';
    const pending = firstValueFrom(requests);
    const values = yesOrNoInputs.map(() => [] as string[]);
    yesOrNoInputs.forEach((input, index) => {
      subscriptions.push(service.getTranslationWithYesOrNo$(phrase, input).subscribe((value) => values[index].push(value)));
    });

    const request = await pending;
    expect(request.url).toBe('/translations/cy');
    expect(request.body).toEqual({ phrases: [phrase] });
    expect(post).toHaveBeenCalledTimes(1);
    request.reply.next({ translations: { [phrase]: { translation: 'Cwestiwn wedi ei gyfieithu', yes: 'ydw', no: 'nac ydw' } } });

    expect(values.map((emissions) => emissions.at(-1))).toEqual(['Ydw', 'ydw', 'Nac ydw', 'nac ydw']);
  });

  it('restores original Yes/No inputs after a successful response without answer metadata', async () => {
    const phrase = 'Do you agree?';
    const pending = firstValueFrom(requests);
    const values = yesOrNoInputs.map(() => [] as string[]);
    const errors: unknown[] = [];
    yesOrNoInputs.forEach((input, index) => {
      subscriptions.push(service.getTranslationWithYesOrNo$(phrase, input).subscribe({
        next: (value) => values[index].push(value),
        error: (error: unknown) => errors.push(error)
      }));
    });

    const request = await pending;
    expect(request.url).toBe('/translations/cy');
    expect(request.body).toEqual({ phrases: [phrase] });
    expect(post).toHaveBeenCalledTimes(1);
    expect(values.map((emissions) => emissions.at(-1))).toEqual([
      'Yes [Translation in progress]', 'yes [translation in progress]',
      'No [Translation in progress]', 'no [translation in progress]'
    ]);
    request.reply.next({ translations: { [phrase]: { translation: 'Cwestiwn wedi ei gyfieithu' } } });

    expect(errors).toEqual([]);
    expect(values.map((emissions) => emissions.at(-1))).toEqual(yesOrNoInputs);
  });
});
