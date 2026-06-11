import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { db } from './db';
import { YesOrNoValue } from './rpx-language.enum';
import { RpxTranslationConfig } from './rpx-translation.config';
import { RpxTranslationService } from './rpx-translation.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('RpxTranslationService', () => {
  let service: RpxTranslationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        RpxTranslationService,
        {
          provide: RpxTranslationConfig,
          useValue: {
            baseUrl: 'translations',
            debounceTimeMs: 500
          }
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(RpxTranslationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    db.delete().catch((error) => console.error('Error deleting db', error));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return the default language en as a string', () => {
    expect(service.language).toEqual('en');
  });

  it('should not call load method with given phrase, language, and yesOrNo value when translation not found in DB', (done) => {
    const spy = jasmine.createSpyObj('RpxTranslationService', ['load']);
    const phrase = 'Hello, world!';
    const language = 'en';
    const yesOrNo = YesOrNoValue.YES;

    // @ts-ignore-error - private method
    const observable = service.translate(phrase);

    observable.subscribe(() => {
      expect(spy.load).not.toHaveBeenCalledWith(phrase, language, yesOrNo);
      done();
    });
  });

  describe('shouldTranslate', () => {
    it('should return false for phrases without alphabetic characters', () => {
      expect((service as any).shouldTranslate('123')).toBe(false);
      expect((service as any).shouldTranslate('!@#$%')).toBe(false);
      expect((service as any).shouldTranslate('   ')).toBe(false);
      expect((service as any).shouldTranslate(' ')).toBe(false);
      expect((service as any).shouldTranslate('___')).toBe(false);
      expect((service as any).shouldTranslate('123-456')).toBe(false);
    });

    it('should return true for phrases with alphabetic characters', () => {
      expect((service as any).shouldTranslate('Hello')).toBe(true);
      expect((service as any).shouldTranslate('Test123')).toBe(true);
      expect((service as any).shouldTranslate('123ABC')).toBe(true);
      expect((service as any).shouldTranslate('ABC123')).toBe(true);
      expect((service as any).shouldTranslate('a')).toBe(true);
      expect((service as any).shouldTranslate('Z')).toBe(true);
    });

    it('should return false for phrases containing [Translation in progress]', () => {
      expect((service as any).shouldTranslate('Hello [Translation in progress]')).toBe(false);
      expect((service as any).shouldTranslate('[Translation in progress]')).toBe(false);
      expect((service as any).shouldTranslate('Some text [Translation in progress] more text')).toBe(false);
    });

    it('should return true for phrases not containing [Translation in progress]', () => {
      expect((service as any).shouldTranslate('Hello World')).toBe(true);
      expect((service as any).shouldTranslate('Translation complete')).toBe(true);
      expect((service as any).shouldTranslate('[Other text]')).toBe(true);
    });

    it('should return false for placeholder-only phrases', () => {
      expect((service as any).shouldTranslate('${key}')).toBe(false);
      expect((service as any).shouldTranslate('  ${someVariable}  ')).toBe(false);
      expect((service as any).shouldTranslate('${userName}')).toBe(false);
      expect((service as any).shouldTranslate('${email}')).toBe(false);
      expect((service as any).shouldTranslate('${count}')).toBe(false);
    });

    it('should return true for phrases containing placeholders with other text', () => {
      expect((service as any).shouldTranslate('Hello ${name}')).toBe(true);
      expect((service as any).shouldTranslate('${count} items')).toBe(true);
      expect((service as any).shouldTranslate('Welcome ${user} to our site')).toBe(true);
    });
  });
});
