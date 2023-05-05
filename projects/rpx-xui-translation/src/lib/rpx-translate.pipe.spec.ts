import { ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';
import { RpxTranslatePipe } from './rpx-translate.pipe';
import { RpxTranslationService } from './rpx-translation.service';

describe('RpxTranslatePipe', () => {
  let translationServiceMock: jasmine.SpyObj<RpxTranslationService>;
  let changeDetectorRefMock: jasmine.SpyObj<ChangeDetectorRef>;
  let pipe: RpxTranslatePipe;

  beforeEach(() => {
    translationServiceMock = jasmine
      .createSpyObj('RpxTranslationService', ['getTranslationWithReplacements', 'getYesOrNoTranslationReplacement', 'getTranslation']);
    changeDetectorRefMock = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
    pipe = new RpxTranslatePipe(translationServiceMock, changeDetectorRefMock);
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should return null when called with null or undefined', () => {
      expect(pipe.transform(null)).toBeNull();
      expect(pipe.transform(undefined)).toBeNull();
    });

    it('should return the same string when called with a string', () => {
      translationServiceMock.getTranslation.and.callFake((someString) => of(someString));

      const translationString = 'Hello World!';
      expect(pipe.transform(translationString)).toBe(translationString);
    });

    it('should call getTranslation with the string argument when no replacements or yesOrNo are provided', () => {
      const str = 'Hello world!';
      const obs = of('Translated string');
      translationServiceMock.getTranslation.and.returnValue(obs);

      pipe.transform(str);

      expect(translationServiceMock.getTranslation).toHaveBeenCalledWith(str);
    });

    it('should call getTranslationWithReplacements with the string and replacements arguments when replacements are provided', () => {
      const str = 'Hello world!';
      const replacements = { name: 'John' };
      const obs = of('Translated string');
      translationServiceMock.getTranslationWithReplacements.and.returnValue(obs);

      pipe.transform(str, replacements);

      expect(translationServiceMock.getTranslationWithReplacements).toHaveBeenCalledWith(str, replacements);
    });

    it('should call getYesTranslationReplacement with the string and yesOrNo argument when yesOrNo is "yes"', () => {
      const str = 'Are you sure?';
      const yesOrNo = 'yes';
      const obs = of('Translated string');
      translationServiceMock.getYesOrNoTranslationReplacement.and.returnValue(obs);

      pipe.transform(str, null, yesOrNo);

      expect(translationServiceMock.getYesOrNoTranslationReplacement).toHaveBeenCalledWith(str, yesOrNo);
    });

    it('should call getNoTranslationReplacement with the string and yesOrNo argument when yesOrNo is "no"', () => {
      const str = 'Are you sure?';
      const yesOrNo = 'no';
      const obs = of('Translated string');
      translationServiceMock.getYesOrNoTranslationReplacement.and.returnValue(obs);

      pipe.transform(str, null, yesOrNo);

      expect(translationServiceMock.getYesOrNoTranslationReplacement).toHaveBeenCalledWith(str, yesOrNo);
    });
  });
});
