import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Injector, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { YesOrNoValue } from './rpx-language.enum';
import { Replacements, RpxTranslationService } from './rpx-translation.service';

@Pipe({
  name: 'rpxTranslate',
  pure: false
})
export class RpxTranslatePipe implements PipeTransform, OnDestroy {
  private asyncPipe: AsyncPipe;

  constructor(
    private translationService: RpxTranslationService,
    private injector: Injector
  ) {
    this.asyncPipe = new AsyncPipe(injector.get(ChangeDetectorRef));
  }

  public transform<T = string>(value: T, replacements?: Replacements | null, yesOrNo?: string): T | null {
    if (typeof value === 'string') {
      let o: Observable<string>;
      if (replacements) {
        o = this.translationService.getTranslationWithReplacements(value, replacements);
      } else if (yesOrNo?.toLowerCase() === YesOrNoValue.YES.toLowerCase() || yesOrNo?.toLowerCase() === YesOrNoValue.NO.toLowerCase()) {
        const yesOrNoValue = yesOrNo?.toLowerCase() === YesOrNoValue.YES.toLowerCase() ? YesOrNoValue.YES : YesOrNoValue.NO;
        o = this.translationService.getYesOrNoTranslationReplacement(value, yesOrNoValue);
      } else {
        o = this.translationService.getTranslation(value);
      }

      const ret = this.asyncPipe.transform<string>(o);
      return ret as unknown as T;
    }
    return null;
  }

  public ngOnDestroy(): void {
    this.asyncPipe.ngOnDestroy();
  }
}
