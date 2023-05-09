import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { YesOrNoValue } from './rpx-language.enum';
import { Replacements, RpxTranslationService } from './rpx-translation.service';

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

  transform<T = string>(value: T, replacements?: Replacements | null, yesOrNo?: string): T | null {
    if (typeof value === 'string') {
      let o: Observable<string>;
      if (replacements) {
        o = this.translationService.getTranslationWithReplacements(value, replacements);
      } else if (yesOrNo?.toLowerCase() === YesOrNoValue.YES.toLowerCase() || yesOrNo?.toLowerCase() === YesOrNoValue.NO.toLowerCase()) {
        o = this.translationService.getYesOrNoTranslationReplacement(value, yesOrNo?.toLowerCase() === YesOrNoValue.YES.toLowerCase() ? YesOrNoValue.YES : YesOrNoValue.NO);
      } else {
        o = this.translationService.getTranslation(value);
      }
      const ret = super.transform<string>(o);
      return ret as unknown as T;
    }
    return null;
  }

}
