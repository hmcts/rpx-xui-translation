import { ChangeDetectorRef } from '@angular/core';
import { RpxTranslatePipe } from './rpx-translate.pipe';
import { RpxTranslationService } from './rpx-translation.service';
import { TranslatedData } from './models/translated-data.model';
import { of } from 'rxjs';

describe('RpxTranslatePipe', () => {
  let translationServiceMock: jasmine.SpyObj<RpxTranslationService>;
  let changeDetectorRefMock: jasmine.SpyObj<ChangeDetectorRef>;
  let pipe: RpxTranslatePipe;

  beforeEach(() => {
    translationServiceMock = jasmine.createSpyObj('RpxTranslationService',
      ['getTranslation']);
    changeDetectorRefMock = jasmine.createSpyObj('ChangeDetectorRef',
      ['markForCheck']);
    pipe = new RpxTranslatePipe(translationServiceMock, changeDetectorRefMock);
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return null when called with null or undefined', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
  });

  it('should transform string value without replacements or yesOrNoValue', () => {
    const value = 'Hello!';
    const translatedData: TranslatedData = {
      phrase: 'Hello! Translated',
      yes: 'Yes Translated',
      no: 'No Translated'
    };

    translationServiceMock.getTranslation.and.returnValue(of(translatedData));
    const transformedValue = pipe.transform(value);

    expect(transformedValue).toBe('Hello! Translated');
  });

  it('should transform string value with replacements and do the replacements', () => {
    const value = 'Hello, %FIELDNAME%!, %OTHERFIELDNAME%';
    const replacements = {FIELDNAME: 'Abcdef', OTHERFIELDNAME: 'Ghijkl'};
    const translatedData: TranslatedData = {
      phrase: 'Hello, %FIELDNAME%, %OTHERFIELDNAME%! Translated',
      yes: 'Yes Translated',
      no: 'No Translated'
    };

    translationServiceMock.getTranslation.and.returnValue(of(translatedData));
    const transformedValue = pipe.transform(value, replacements);

    expect(transformedValue).toBe('Hello, Abcdef, Ghijkl! Translated');
  });

  it('should transform string value with yesOrNo and return yes/no translated', () => {
    const value = 'Hello, %FIELDNAME%!, %OTHERFIELDNAME%';
    const translatedData: TranslatedData = {
      phrase: 'Hello, %FIELDNAME%, %OTHERFIELDNAME%! Translated',
      yes: 'Yes Translated',
      no: 'No Translated'
    };

    translationServiceMock.getTranslation.and.returnValue(of(translatedData));
    const transformedValue = pipe.transform(value, null, 'yes');

    expect(transformedValue).toBe('Yes Translated');
  });

  it('should return null for non-string value', () => {
    const value = 123;

    const transformedValue = pipe.transform(value);

    expect(transformedValue).toBeNull();
  });
});
