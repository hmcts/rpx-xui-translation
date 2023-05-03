import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { Observable, Subscribable } from 'rxjs';
import { RpxTranslationService, Replacements } from './rpx-translation.service';
import { YesOrNoValue } from './rpx-language.enum';

@Pipe({
  name: 'rpxTranslate',
  pure: false
})
export class RpxTranslatePipe extends AsyncPipe implements PipeTransform {

  constructor(
    private translationService: RpxTranslationService,
    ref: ChangeDetectorRef
  ) {
    super(ref);
  }

  transform<T>(obj: Observable<T> | Subscribable<T> | Promise<T>): T | null;
  transform<T>(obj: null | undefined): null;
  transform<T>(obj: Observable<T> | Subscribable<T> | Promise<T> | null | undefined): T | null;
  transform<T = string>(value: T): T | null;
  transform<T = string>(value: T, replacements?: Replacements | null, yesOrNo?: string): T | null {
    if (typeof value === 'string') {
      let o: Observable<string>;
      if (replacements) {
        o = this.translationService.getTranslationWithReplacements(value, replacements);
      } else if (yesOrNo?.toLowerCase() === YesOrNoValue.YES) {
        o = this.translationService.getYesTranslationReplacement(value, yesOrNo);
      } else if (yesOrNo?.toLowerCase() === YesOrNoValue.NO) {
        o = this.translationService.getNoTranslationReplacement(value, yesOrNo);
      } else {
        o = this.translationService.getTranslation(value);
      }
      const ret = super.transform<string>(o);
      return ret as unknown as T;
    }
    return null;
  }

}
