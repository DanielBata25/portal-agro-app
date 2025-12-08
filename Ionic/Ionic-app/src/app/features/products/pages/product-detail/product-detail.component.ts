import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonItem, IonLabel, IonIcon, IonBadge,
  IonSpinner, IonList, IonTextarea
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cart, star, starOutline, personCircle, location, heart, heartOutline } from 'ionicons/icons';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import { ProductService } from '../../../../shared/services/product/product.service';
import { ReviewService } from '../../../../shared/services/review/review.service';
import { ProductSelectModel, ReviewSelectModel, ReviewRegisterModel } from '../../../../shared/models/product/product.model';
import { ProducerService } from 'src/app/shared/services/producer/producer.service';

import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { UserMeDto } from 'src/app/core/models/login.model';
import { AuthState } from 'src/app/core/services/auth/auth.state';
import { Location } from '@angular/common';
import { FavoriteFacadeService } from 'src/app/shared/services/favorite/favorite-facade.service';

// Swiper Web Components
import { register } from 'swiper/element/bundle';

// Modal de Order (Ionic)
import { OrderCreateModalComponent, OrderCreateDialogData } from '../../modals/order-create-dialog/order-create-dialog.component'; // ajusta la ruta real
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent,
    IonIcon, IonBadge,
    IonSpinner, IonTextarea, 
    ButtonComponent
],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [AlertController, ToastController, ModalController],
})
export class ProductDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('swiperRef') swiperRef?: ElementRef<HTMLElement>;
  private viewReady = false;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private reviewService = inject(ReviewService);
  private authState = inject(AuthState);
  private location = inject(Location);
  private favoriteFacade = inject(FavoriteFacadeService);
  private producerService = inject(ProducerService);
  private ownershipChecked = false;

  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  me$: Observable<UserMeDto | null> = of(null);

  productId!: number;
  product!: ProductSelectModel;
  loadingProduct = true;
  galleryImages: string[] = [];
  myProducerCode?: string;
  isOwnProduct = false;

  // Carrusel (atributos de Web Component)
  slidesOpts = { slidesPerView: 1, spaceBetween: 12, pagination: true };
  private readonly fallbackImage = 'assets/backgrounds/descarga.jpg';

  reviews: ReviewSelectModel[] = [];
  loadingReviews = true;
  newReview = '';
  selectedRating = 0;
  hoverRating = 0;
  readonly starScale = [1, 2, 3, 4, 5] as const;

  averageRating = 0;
  distribution: { star: number; count: number; percentage: number }[] = [];
  totalReviews = 0;

  Math = Math;

  sendingReview = false;
  private readonly ratingLabels = ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'] as const;

  constructor() {
    addIcons({ cart, star, starOutline, personCircle, location, heart, heartOutline });
    register(); // habilita <swiper-container> y <swiper-slide>
  }

  ngOnInit(): void {
    void this.authState.hydrateFromStorage();
    this.me$ = this.authState.loadMe();

    this.productId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.productId) return;

    this.fetchProducerCode();
    this.loadProduct();
    this.loadReviews();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initSwiperAutoplay();
  }

  private loadProduct(): void {
    this.loadingProduct = true;
    this.productService.getById(this.productId).subscribe({
      next: (data) => {
        this.product = data;
        this.galleryImages = this.buildGalleryImages(data);
        this.updateIsOwnProduct();
        this.loadingProduct = false;
        this.initSwiperAutoplay();
      },
      error: () => {
        this.loadingProduct = false;
        this.showToast('No se pudo cargar el producto', 'danger');
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  private initSwiperAutoplay(): void {
    if (!this.viewReady) return;
    if (this.galleryImages.length <= 1) return;

    requestAnimationFrame(() => {
      const swiperEl: any = this.swiperRef?.nativeElement;
      if (!swiperEl) return;

      if (typeof swiperEl.initialize === 'function' && !swiperEl.classList.contains('swiper-initialized')) {
        swiperEl.initialize();
      } else if (swiperEl.swiper?.update) {
        swiperEl.swiper.update();
      }

      const swiper = swiperEl.swiper;
      if (swiper?.autoplay) {
        swiper.params.autoplay = swiper.params.autoplay || {};
        swiper.params.autoplay.delay = 4000;
        swiper.params.autoplay.disableOnInteraction = false;
        swiper.autoplay.stop();
        swiper.autoplay.start();
      }
    });
  }

  private buildGalleryImages(product?: ProductSelectModel): string[] {
    if (!product) return [];

    const urls: string[] = [];
    const images = Array.isArray(product.images) ? product.images : [];

    for (const img of images) {
      const url = typeof img?.imageUrl === 'string' ? img.imageUrl.trim() : '';
      if (url) urls.push(url);
    }

    if (!urls.length) urls.push(this.fallbackImage);

    return urls;
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackImage;
  }

  private fetchProducerCode(): void {
    this.producerService.getMine().subscribe({
      next: (producer) => {
        this.myProducerCode = producer?.code?.trim();
        this.updateIsOwnProduct();
      },
      error: () => {
        this.myProducerCode = undefined;
        this.isOwnProduct = false;
      },
    });
  }

  private updateIsOwnProduct(): void {
    const productCode = (this.product?.producerCode || '').trim().toLowerCase();
    const myCode = (this.myProducerCode || '').trim().toLowerCase();
    this.isOwnProduct = Boolean(productCode && myCode && productCode === myCode);

    // Fallback: si no se pudo obtener el código o no coincide, revisa la lista del productor
    if (!this.isOwnProduct && !this.ownershipChecked && this.productId) {
      this.ownershipChecked = true;
      this.productService.getByProducerId().subscribe({
        next: (list) => {
          const owns = Array.isArray(list) && list.some((p) => p?.id === this.productId);
          if (owns) this.isOwnProduct = true;
        },
        error: () => {},
      });
    }
  }

  private loadReviews(): void {
    this.loadingReviews = true;
    this.reviewService.getReviewByProduct(this.productId).subscribe({
      next: (list) => {
        this.reviews = list ?? [];
        this.recomputeStats();
        this.loadingReviews = false;
      },
      error: () => {
        this.loadingReviews = false;
        this.showToast('No se pudieron cargar las resenas', 'warning');
      },
    });
  }

  // === Pedido (relacion con Order) ===
  async openCreateOrder(): Promise<void> {
    if (this.isOwnProduct) {
      await this.showToast('No puedes comprar tu propio producto', 'warning', 'bottom');
      return;
    }
    const me = await firstValueFrom(this.me$);
    if (!me) {
      const alert = await this.alertCtrl.create({
        header: 'Inicia sesion',
        message: 'Debes iniciar sesion para crear un pedido.',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Ir a iniciar sesion',
            handler: () => this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } }),
          },
        ],
      });
      await alert.present();
      return;
    }

    if ((this.product?.stock ?? 0) <= 0) {
      const alert = await this.alertCtrl.create({
        header: 'Sin stock',
        message: 'Este producto no tiene stock disponible.',
        buttons: ['Entendido'],
      });
      await alert.present();
      return;
    }

    // Abrimos el modal de Order (Ionic)
    const modal = await this.modalCtrl.create({
      component: OrderCreateModalComponent,
      componentProps: {
        data: {
          productId: this.product.id,
          productName: this.product.name,
          unitPrice: this.product.price,
          stock: this.product.stock,
          shippingNote: this.product.shippingIncluded ? 'Envio gratis' : 'No incluye envio',
        } as OrderCreateDialogData
      },
      breakpoints: [0, 0.7, 0.95],
      initialBreakpoint: 0.7,
      backdropDismiss: false
    });
    await modal.present();

    const { data } = await modal.onWillDismiss<{ created?: boolean; order?: any }>();
    if (data?.created) {
      const orderId = data.order?.id || data.order?.orderId;
      const msg = data.order?.message || (orderId ? `Pedido #${orderId} creado` : 'Pedido creado correctamente.');
      this.showToast(msg, 'success', 'bottom');
    }
  }

  onDetail(item: ProductSelectModel) {
    this.router.navigate(['home/product/profile', item.producerCode]);
  }

  setRating(v: number) { this.selectedRating = v; }
  onMouseEnter(r: number) { this.hoverRating = r; }
  onMouseLeave() { this.hoverRating = 0; }

  submitReview(): void {
    if (this.isOwnProduct) {
      this.showToast('No puedes reseñar tu propio producto', 'warning', 'bottom');
      return;
    }
    if (this.sendingReview) return;
    if (this.selectedRating < 1 || this.selectedRating > 5) return;
    const comment = this.newReview.trim();
    if (comment.length < 4) {
      void this.showToast('La reseña debe tener al menos 4 caracteres.', 'warning', 'bottom');
      return;
    }

    const payload: ReviewRegisterModel = { 
      productId: this.productId, 
      rating: this.selectedRating, 
      comment 
    };

    // 👇 Log para depuración
    console.log('Payload reseña:', payload);

    this.sendingReview = true;
    this.loadingReviews = true;

    this.reviewService.createReview(payload).pipe(
      switchMap(() => this.reviewService.getReviewByProduct(this.productId)),
      finalize(() => { this.sendingReview = false; })
    ).subscribe({
      next: (list) => {
        this.reviews = list ?? [];
        this.recomputeStats();
        this.newReview = '';
        this.selectedRating = 0;
        this.hoverRating = 0;
        this.loadingReviews = false;
        this.showToast('Reseña publicada', 'success', 'bottom');
      },
      error: (err) => {
        this.loadingReviews = false;
        console.error('[Review][create]', err);
        const message =
          (err as any)?.data?.message ||
          (err as any)?.error?.message ||
          err?.message ||
          'No se pudo publicar la reseña';
        this.showToast(message, 'danger', 'bottom');
      },
    });
  }

  async deleteReview(reviewId: number): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar resena?',
      message: 'Esta accion no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar', role: 'destructive',
          handler: async () => {
            try {
              await firstValueFrom(this.reviewService.deleteReview(reviewId));
              this.reviews = this.reviews.filter(r => r.id !== reviewId);
              this.recomputeStats();
              this.showToast('Resena eliminada', 'success', 'bottom');
            } catch (e: any) {
              this.showToast(e?.error?.message ?? 'No se pudo eliminar la resena', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private recomputeStats(): void {
    const n = this.reviews.length;
    this.totalReviews = n;

    if (n === 0) {
      this.averageRating = 0;
      this.distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: 0, percentage: 0 }));
      return;
    }
    const sum = this.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    this.averageRating = sum / n;

    const counts: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    for (const r of this.reviews) counts[r.rating] = (counts[r.rating] ?? 0) + 1;

    this.distribution = [5,4,3,2,1].map(star => {
      const count = counts[star] ?? 0;
      const percentage = (count / n) * 100;
      return { star, count, percentage };
    });
  }

  trackByReview = (_: number, r: ReviewSelectModel) => r.id;

  get ratingLabel(): string {
    const idx = (this.hoverRating || this.selectedRating) - 1;
    return idx >= 0 ? this.ratingLabels[idx] : '';
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'medium' = 'medium',
    position: 'top' | 'bottom' | 'middle' = 'bottom'
  ) {
    const t = await this.toastCtrl.create({ message, duration: 1600, position, color });
    await t.present();
  }

  get favoriteLoading(): boolean {
    return this.favoriteFacade.isToggling(this.product?.id);
  }

  toggleFavorite(ev: Event): void {
    ev.stopPropagation();
    if (!this.product || this.favoriteLoading) return;

    this.favoriteFacade.toggle(this.product).subscribe({
      next: (isFav) => {
        this.product.isFavorite = isFav;
        this.showToast(isFav ? 'Añadido a favoritos' : 'Quitado de favoritos', 'success', 'bottom');
      },
      error: () => {
        this.showToast('No se pudo actualizar el favorito', 'danger', 'bottom');
      },
    });
  }
}
