import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { db } from './db';
import { RpxTranslationService } from './rpx-translation.service';

type TranslationReply = { translations: Record<string, string> };
type TranslationRequest = { url: string; body: unknown; reply: Subject<TranslationReply> };

describe('RpxTranslationService request lifecycle', () => {
  let service: RpxTranslationService;
  let requests: Subject<TranslationRequest>;
  let post: jasmine.Spy<(url: string, body: unknown) => Subject<TranslationReply>>;
  let subscriptions: Subscription[];

  beforeEach(() => {
    document.cookie = 'exui-preferred-language=; Max-Age=0; SameSite=Strict;';
    requests = new Subject<TranslationRequest>();
    subscriptions = [];
    post = jasmine.createSpy<(url: string, body: unknown) => Subject<TranslationReply>>('post').and.callFake((url, body) => {
      const reply = new Subject<TranslationReply>();
      requests.next({ url, body: structuredClone(body), reply });
      return reply;
    });
    // These request tests model cache misses; real IndexedDB refresh/restore is covered by Playwright.
    spyOn(db.translations, 'where').and.returnValue({
      equals: () => ({ first: () => Promise.resolve(undefined) })
    } as unknown as ReturnType<typeof db.translations.where>);
    spyOn(db.translations, 'bulkAdd').and.stub();
    service = new RpxTranslationService({ baseUrl: '/translations', debounceTimeMs: 20, validity: { days: 1 }, testMode: false }, { post } as unknown as HttpClient);
    service.language = 'cy';
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    requests.complete();
    document.cookie = 'exui-preferred-language=; Max-Age=0; SameSite=Strict;';
  });

  it('batches distinct phrases and deduplicates repeated subscriptions and normalized aliases', async () => {
    const pending = firstValueFrom(requests);
    const notice: string[] = [];
    const alias: string[] = [];
    const hearing: string[] = [];
    subscriptions.push(service.getTranslation$('Notice of charge').subscribe((value) => notice.push(value)));
    subscriptions.push(service.getTranslation$('Notice of charge').subscribe((value) => notice.push(value)));
    subscriptions.push(service.getTranslation$('Notice  of charge').subscribe((value) => alias.push(value)));
    subscriptions.push(service.getTranslation$('Hearing date').subscribe((value) => hearing.push(value)));

    const request = await pending;
    expect(request.url).toBe('/translations/cy');
    expect(request.body).toEqual({ phrases: ['Notice of charge', 'Hearing date'] });
    expect(post).toHaveBeenCalledTimes(1);
    request.reply.next({ translations: { 'Notice of charge': 'Hysbysiad o arwystl', 'Hearing date': 'Dyddiad y gwrandawiad' } });
    request.reply.complete();

    expect(notice.slice(-2)).toEqual(['Hysbysiad o arwystl', 'Hysbysiad o arwystl']);
    expect(alias.at(-1)).toBe('Hysbysiad o arwystl');
    expect(hearing.at(-1)).toBe('Dyddiad y gwrandawiad');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('uses source fallback in production mode and allows a subsequent phrase to translate', async () => {
    const pendingFailure = firstValueFrom(requests);
    const failed: string[] = [];
    subscriptions.push(service.getTranslation$('Notice of charge').subscribe((value) => failed.push(value)));
    const failure = await pendingFailure;
    expect(failure.body).toEqual({ phrases: ['Notice of charge'] });
    expect(failed.at(-1)).toBe('Notice of charge [Translation in progress]');
    failure.reply.error(new HttpErrorResponse({ status: 500, statusText: 'Synthetic failure' }));
    expect(failed.at(-1)).toBe('Notice of charge');

    const pendingRecovery = firstValueFrom(requests);
    const recovered: string[] = [];
    subscriptions.push(service.getTranslation$('Hearing date').subscribe((value) => recovered.push(value)));
    const recovery = await pendingRecovery;
    expect(recovery.url).toBe('/translations/cy');
    expect(recovery.body).toEqual({ phrases: ['Hearing date'] });
    expect(recovered.at(-1)).toBe('Hearing date [Translation in progress]');
    recovery.reply.next({ translations: { 'Hearing date': 'Dyddiad y gwrandawiad' } });
    recovery.reply.complete();
    expect(recovered.at(-1)).toBe('Dyddiad y gwrandawiad');
    expect(failed.at(-1)).toBe('Notice of charge');
    expect(post).toHaveBeenCalledTimes(2);
  });
});
