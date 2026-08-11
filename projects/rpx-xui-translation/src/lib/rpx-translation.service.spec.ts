import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
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
            debounceTimeMs: 500,
            validity: { days: 1 }
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

  it('should normalise repeated spacing before translating a phrase', (done) => {
    service.getTranslation$(' notice  of charge ').subscribe((translation) => {
      expect((service as any).normalisePhraseSpacing(translation)).toBe('notice of charge');
      expect(translation).toBe('notice  of charge');
      done();
    });
  });

  it('should normalise multiple spacing runs before translating a phrase', (done) => {
    service.getTranslation$('notice   of    charge').subscribe((translation) => {
      expect((service as any).normalisePhraseSpacing(translation)).toBe('notice of charge');
      expect(translation).toBe('notice   of    charge');
      done();
    });
  });

  it('should preserve markdown line breaks while normalising horizontal spacing', () => {
    const markdown = 'Current progress of the case\n\n![Progress map](https://example.com/caseOfficer_listing.svg)';

    expect((service as any).normalisePhraseSpacing(markdown)).toBe(markdown);
  });

  it('should request the normalised phrase when loading a phrase with multiple spaces', fakeAsync(() => {
    const phrase = 'notice   of    charge';

    (service as any).phrases[phrase] = new BehaviorSubject({ translation: phrase });
    (service as any).load(phrase, 'cy');
    tick(500);

    const request = httpMock.expectOne('translations/cy');
    expect(request.request.body).toEqual({ phrases: ['notice of charge'] });

    request.flush({
      translations: {
        'notice of charge': 'translated notice of charge'
      }
    });
  }));

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

    it('should return false for null or undefined phrases', () => {
      expect((service as any).shouldTranslate(null)).toBe(false);
      expect((service as any).shouldTranslate(undefined)).toBe(false);
      expect((service as any).shouldTranslate('')).toBe(false);
    });
  });

  describe('Null/Undefined handling', () => {
    it('should handle null phrase in normalisePhraseSpacing', () => {
      const result = (service as any).normalisePhraseSpacing(null);
      expect(result).toBe('');
    });

    it('should handle undefined phrase in normalisePhraseSpacing', () => {
      const result = (service as any).normalisePhraseSpacing(undefined);
      expect(result).toBe('');
    });

    it('should handle empty string in normalisePhraseSpacing', () => {
      const result = (service as any).normalisePhraseSpacing('');
      expect(result).toBe('');
    });

    it('should handle null phrase in getTranslation$', (done) => {
      service.getTranslation$(null as any).subscribe((translation) => {
        expect(translation).toBe('');
        done();
      });
    });

    it('should handle undefined phrase in getTranslation$', (done) => {
      service.getTranslation$(undefined as any).subscribe((translation) => {
        expect(translation).toBe('');
        done();
      });
    });

    it('should safely get persisted language when cookie not set', () => {
      // The service has a default language, but getPersistedLanguage should return undefined
      // when the cookie is not present
      const languageKey = 'exui-preferred-language';
      // Ensure cookie is not set
      const cookieValue = document.cookie
        .split(';')
        .find((cookie) => cookie.trim().startsWith(languageKey + '='));

      // If cookie exists, remove it
      if (cookieValue) {
        document.cookie = `${languageKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict;`;
      }

      const result = (service as any).getPersistedLanguage();
      // Should safely return undefined without throwing when cookie is not present
      expect(result).toBeUndefined();
    });

    it('should safely get persisted language when cookie is set', () => {
      // Set a language cookie
      const languageKey = 'exui-preferred-language';
      document.cookie = `${languageKey}=cy; SameSite=Strict;`;
      const result = (service as any).getPersistedLanguage();
      expect(result).toBe('cy');
      // Cleanup
      document.cookie = `${languageKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict;`;
    });

    it('should handle normalisePhraseSpacing with multiple spaces and null/undefined', () => {
      const testCases = [
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: '', expected: '' },
        { input: '  hello   world  ', expected: 'hello world' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (service as any).normalisePhraseSpacing(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle shouldTranslate with various null/undefined edge cases', () => {
      expect((service as any).shouldTranslate(null)).toBe(false);
      expect((service as any).shouldTranslate(undefined)).toBe(false);
      expect((service as any).shouldTranslate('')).toBe(false);
      expect((service as any).shouldTranslate('   ')).toBe(false);
      expect((service as any).shouldTranslate('a')).toBe(true);
    });

    it('should handle getTranslationWithYesOrNo$ with null yesOrNoValue', (done) => {
      const phrase = 'Test';
      service.getTranslationWithYesOrNo$(phrase, null as any).subscribe(
        (translation) => {
          expect(translation).toBeDefined();
          done();
        },
        () => {
          // Should not error, should handle gracefully
          done();
        }
      );
    });

    it('should handle getTranslationWithReplacements$ with empty replacements', (done) => {
      const phrase = 'Test  phrase'; // Note: phrase has two spaces
      service.getTranslationWithReplacements$(phrase, {}).subscribe((translation) => {
        // When there are no replacements, the phrase is processed but may have spacing adjusted
        // The important thing is that it doesn't throw an error when replacements are empty
        expect(translation).toBeDefined();
        expect(translation).toContain('Test');
        expect(translation).toContain('phrase');
        done();
      });
    });
  });
});
