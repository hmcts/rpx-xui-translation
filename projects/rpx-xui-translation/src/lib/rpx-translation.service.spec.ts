import { TestBed } from '@angular/core/testing';

import { RpxTranslationService } from './rpx-translation.service';

describe('RpxTranslationService', () => {
  let service: RpxTranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RpxTranslationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
