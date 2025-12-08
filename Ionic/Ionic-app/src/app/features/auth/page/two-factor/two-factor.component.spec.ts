import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TwoFactorComponent } from './two-factor.component';

describe('TwoFactorComponent', () => {
  let component: TwoFactorComponent;
  let fixture: ComponentFixture<TwoFactorComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TwoFactorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwoFactorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
