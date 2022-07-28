import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { Observable, Subscribable } from 'rxjs';
import { RpxTranslationService } from './rpx-translation.service';

@Pipe({
  name: 'rpxTranslate',
  pure: false
})
export class RpxTranslatePipe extends AsyncPipe implements PipeTransform  {

  constructor(
    private translationService: RpxTranslationService,
    ref: ChangeDetectorRef
  ) {
    super(ref);
  }

  transform<T>(obj: Observable<T>|Subscribable<T>|Promise<T>): T|null;
  transform<T>(obj: null|undefined): null;
  transform<T>(obj: Observable<T>|Subscribable<T>|Promise<T>|null|undefined): T|null;
  transform<T = string>(value: T): T|null;
  transform<T = string>(value: T): T|null {
    if (typeof value === 'string') {
      // lot of casting needed to move from the interface provided by async to the interface we need. We know value is always a string,
      // but due to overloading the async interface we can't specify that.
      const o = this.translationService.translate(value as unknown as string) as unknown as Observable<T>;
      const ret = super.transform<T>(o);
      return ret;
    }
    return null;
  }

}
