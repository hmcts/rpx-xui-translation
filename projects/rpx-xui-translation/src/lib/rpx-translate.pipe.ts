import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Injector, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { Replacements, RpxTranslationService } from './rpx-translation.service';

@Pipe({
    name: 'rpxTranslate',
    pure: false,
    standalone: false
})
export class RpxTranslatePipe implements PipeTransform, OnDestroy {
  private asyncPipe: AsyncPipe;

  constructor(
    private translationService: RpxTranslationService,
    private injector: Injector
  ) {
    this.asyncPipe = new AsyncPipe(injector.get(ChangeDetectorRef));
  }

  public transform<T = string>(value: T, replacements?: Replacements | null, yesOrNoValue?: string): T | null {
    if (value && typeof value === 'string' && value.toString().trim()) {
      let o: Observable<string>;
      if (replacements) {
        o = this.translationService.getTranslationWithReplacements$(value, replacements);
      } else if (yesOrNoValue) {
        o = this.translationService.getTranslationWithYesOrNo$(value, yesOrNoValue);
      } else {
        o = this.translationService.getTranslation$(value);
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
