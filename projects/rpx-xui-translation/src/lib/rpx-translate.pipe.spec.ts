import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RpxTranslatePipe } from './rpx-translate.pipe';
import { RpxTranslationService } from './rpx-translation.service';
import { of, Subject } from 'rxjs';

describe('RpxTranslatePipe', () => {
  let translationServiceMock: jasmine.SpyObj<RpxTranslationService>;
  let pipe: RpxTranslatePipe;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    translationServiceMock = jasmine
      .createSpyObj('RpxTranslationService', ['getTranslationWithReplacements$', 'getTranslationWithYesOrNo$', 'getTranslation$']);

    changeDetectorRef = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck', 'detach', 'detectChanges', 'checkNoChanges', 'reattach']);
    TestBed.configureTestingModule({
      providers: [
        RpxTranslatePipe,
        { provide: RpxTranslationService, useValue: translationServiceMock },
        { provide: ChangeDetectorRef, useValue: changeDetectorRef }
      ]
    });

    pipe = TestBed.inject(RpxTranslatePipe);
  });

  afterEach(() => pipe.ngOnDestroy());

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('shows asynchronous updates and releases the previous input stream', () => {
      const notice = new Subject<string>();
      const hearing = new Subject<string>();
      translationServiceMock.getTranslation$.and.callFake((phrase) => phrase === 'Notice' ? notice : hearing);

      expect(pipe.transform('Notice')).toBeNull();
      expect(notice.observed).toBeTrue();
      notice.next('Hysbysiad');
      expect(changeDetectorRef.markForCheck).toHaveBeenCalledTimes(1);
      expect(pipe.transform('Notice')).toBe('Hysbysiad');
      notice.next('Hysbysiad wedi newid');
      expect(pipe.transform('Notice')).toBe('Hysbysiad wedi newid');

      expect(pipe.transform('Hearing')).toBeNull();
      expect(notice.observed).toBeFalse();
      expect(hearing.observed).toBeTrue();
      changeDetectorRef.markForCheck.calls.reset();
      notice.next('Stale notice');
      expect(changeDetectorRef.markForCheck).not.toHaveBeenCalled();
      expect(pipe.transform('Hearing')).toBeNull();
      hearing.next('Gwrandawiad');
      expect(pipe.transform('Hearing')).toBe('Gwrandawiad');
      expect(changeDetectorRef.markForCheck).toHaveBeenCalledTimes(1);
    });

    it('switches replacement arguments and gives replacements precedence over Yes/No', () => {
      const first = new Subject<string>();
      const second = new Subject<string>();
      const firstReplacements = { COUNT: '1' };
      const secondReplacements = { COUNT: '2' };
      translationServiceMock.getTranslationWithReplacements$
        .and.callFake((_phrase, replacements) => replacements === firstReplacements ? first : second);

      expect(pipe.transform('%COUNT% items', firstReplacements, 'Yes')).toBeNull();
      first.next('1 eitem');
      expect(pipe.transform('%COUNT% items', firstReplacements, 'Yes')).toBe('1 eitem');
      expect(pipe.transform('%COUNT% items', secondReplacements, 'Yes')).toBeNull();
      expect(first.observed).toBeFalse();
      expect(second.observed).toBeTrue();
      first.next('Stale count');
      expect(pipe.transform('%COUNT% items', secondReplacements, 'Yes')).toBeNull();
      second.next('2 eitem');
      expect(pipe.transform('%COUNT% items', secondReplacements, 'Yes')).toBe('2 eitem');
      expect(translationServiceMock.getTranslationWithReplacements$).toHaveBeenCalledWith('%COUNT% items', secondReplacements);
      expect(translationServiceMock.getTranslationWithYesOrNo$).not.toHaveBeenCalled();
      expect(translationServiceMock.getTranslation$).not.toHaveBeenCalled();
    });

    it('switches from Yes to No and releases the active stream on destruction', () => {
      const yes = new Subject<string>();
      const no = new Subject<string>();
      translationServiceMock.getTranslationWithYesOrNo$.and.callFake((_phrase, value) => value === 'Yes' ? yes : no);

      expect(pipe.transform('Are you sure?', null, 'Yes')).toBeNull();
      yes.next('Ydw');
      expect(pipe.transform('Are you sure?', null, 'Yes')).toBe('Ydw');
      expect(pipe.transform('Are you sure?', null, 'No')).toBeNull();
      expect(yes.observed).toBeFalse();
      no.next('Nac ydw');
      expect(pipe.transform('Are you sure?', null, 'No')).toBe('Nac ydw');
      expect(translationServiceMock.getTranslationWithYesOrNo$).toHaveBeenCalledWith('Are you sure?', 'No');

      pipe.ngOnDestroy();
      expect(no.observed).toBeFalse();
      changeDetectorRef.markForCheck.calls.reset();
      no.next('After destruction');
      expect(changeDetectorRef.markForCheck).not.toHaveBeenCalled();
    });

    it('should return null when called with null or undefined', () => {
      expect(pipe.transform(null)).toBeNull();
      expect(pipe.transform(undefined)).toBeNull();
    });

    it('should return the same string when called with a string', () => {
      translationServiceMock.getTranslation$.and.callFake((someString) => of(someString));

      const translationString = 'Hello World!';
      expect(pipe.transform(translationString)).toBe(translationString);
    });

    it('should call getTranslation with the string argument when no replacements or yesOrNo are provided', () => {
      const str = 'Hello world!';
      const obs = of('Translated string');
      translationServiceMock.getTranslation$.and.returnValue(obs);

      pipe.transform(str);

      expect(translationServiceMock.getTranslation$).toHaveBeenCalledWith(str);
    });

    it('should call getTranslationWithReplacements with the string and replacements arguments when replacements are provided', () => {
      const str = 'Hello world!';
      const replacements = { name: 'John' };
      const obs = of('Translated string');
      translationServiceMock.getTranslationWithReplacements$.and.returnValue(obs);

      pipe.transform(str, replacements);

      expect(translationServiceMock.getTranslationWithReplacements$).toHaveBeenCalledWith(str, replacements);
    });

    it('should call getYesTranslationReplacement with the string and yesOrNo argument when yesOrNo is "yes"', () => {
      const str = 'Are you sure?';
      const yesOrNo = 'Yes';
      const obs = of('Translated string');
      translationServiceMock.getTranslationWithYesOrNo$.and.returnValue(obs);

      pipe.transform(str, null, yesOrNo);

      expect(translationServiceMock.getTranslationWithYesOrNo$).toHaveBeenCalledWith(str, yesOrNo);
    });

    it('should call getNoTranslationReplacement with the string and yesOrNo argument when yesOrNo is "no"', () => {
      const str = 'Are you sure?';
      const yesOrNo = 'No';
      const obs = of('Translated string');
      translationServiceMock.getTranslationWithYesOrNo$.and.returnValue(obs);

      pipe.transform(str, null, yesOrNo);

      expect(translationServiceMock.getTranslationWithYesOrNo$).toHaveBeenCalledWith(str, yesOrNo);
    });
  });
});
