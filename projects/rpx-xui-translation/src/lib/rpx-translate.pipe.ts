import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { Replacements, RpxTranslationService } from './rpx-translation.service';
import { YesOrNoValue } from './rpx-language.enum';
import { TranslatedData } from './helpers/models/translated-data.model';
import { replacePlaceholders } from './helpers/replace-placeholders/replace-placeholders.helper';
import { matchCase } from './helpers/match-case/match-case.helper';

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

  transform<T = string>(value: T, replacements?: Replacements | null, yesOrNoValue?: string): T | null {
    if (typeof value === 'string') {
      let retString: string;
      const o: Observable<TranslatedData> = this.translationService.getTranslation(value, yesOrNoValue);
      const ret = super.transform<TranslatedData>(o);

      if (ret) {
        const isYes = yesOrNoValue?.toLowerCase() === YesOrNoValue.YES.toLowerCase();
        const isNo = yesOrNoValue?.toLowerCase() === YesOrNoValue.NO.toLowerCase();

        if (replacements) {
          retString = replacePlaceholders(ret.phrase, replacements);
        } else if (isYes || isNo) {
          retString = isYes ? (ret?.yes || yesOrNoValue!) : (ret?.no || yesOrNoValue!);
          matchCase(retString, yesOrNoValue!);
        } else {
          retString = ret.phrase;
        }
      } else {
        retString = yesOrNoValue ? yesOrNoValue : value;
      }

      return retString as unknown as T;
    }

    return null;
  }
}
