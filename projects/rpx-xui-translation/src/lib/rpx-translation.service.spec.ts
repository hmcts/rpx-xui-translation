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
});
