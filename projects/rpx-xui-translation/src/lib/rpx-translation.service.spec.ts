import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RpxTranslationService } from './rpx-translation.service';
import { RpxTranslationConfig } from './rpx-translation.config';
import { db, Translation } from './db';
import { RpxLanguage, YesOrNoValue } from './rpx-language.enum';

describe('RpxTranslationService', () => {
  let service: RpxTranslationService;
  let httpMock: HttpTestingController;
  const model = {
    phrase: 'Hello, world!',
    yesOrNoField: true,
    yes: 'Yes',
    no: 'No'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        RpxTranslationService,
        {
          provide: RpxTranslationConfig,
          useValue: {
            baseUrl: 'translations',
            debounceTimeMs: 500
          }
        }
      ]
    });
    service = TestBed.inject(RpxTranslationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    db.delete().catch(error => console.error('Error deleting db', error));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return the default language en as a string', () => {
    expect(service.language).toEqual('en');
  });

  it('returns the phrase when yesOrNoValue is undefined', () => {
    const result = service.getPhrase(model, undefined);
    expect(result).toEqual(model.phrase);
  });

  it('should not call load method with given phrase, language, and yesOrNo value when translation not found in DB', (done) => {
    const spy = jasmine.createSpyObj('RpxTranslationService', ['load']);
    const phrase = 'Hello, world!';
    const language = 'en';
    const yesOrNo = YesOrNoValue.YES;

    const observable = service.translate(phrase, yesOrNo);

    observable.subscribe(() => {
      expect(spy.load).not.toHaveBeenCalledWith(phrase, language, yesOrNo);
      done();
    });
  });

  it('returns the yes value when yesOrNoValue is YES and yes is defined', () => {
    const result = service.getPhrase(model, YesOrNoValue.YES);
    expect(result).toEqual(model.yes);
  });

  it('returns the no value when yesOrNoValue is NO and no is defined', () => {
    const result = service.getPhrase(model, YesOrNoValue.NO);
    expect(result).toEqual(model.no);
  });
});
