/** STEP 2 — Delivery method. */
export function ShippingStep({
  value,
  onChange,
}: {
  value: DeliveryMethod;
  onChange: (method: DeliveryMethod) => void;
}) {
  return (
    <>
      <h2 className="section-title">Delivery Method</h2>
      {DELIVERY_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="opt-card"
          data-active={value === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className="opt-radio">
            {value === option.id ? <motion.span layoutId="delivery-radio" /> : null}
          </span>
          <span className="opt-icon">
            <Icon name={option.icon} size={18} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="semi t-md">{option.title}</span>
            <span className="text-3 t-xs">{option.detail}</span>
          </span>
          <span className="spacer" />
          <span className="t-sm semi">{option.fee === 0 ? 'Free' : formatPrice(option.fee)}</span>
        </button>
      ))}
    </>
  );
}

/** STEP 3 — Payment method. */
export function PaymentStep({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <>
      <h2 className="section-title">Payment</h2>
      {PAYMENT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="opt-card"
          data-active={value === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className="opt-radio">
            {value === option.id ? <motion.span layoutId="payment-radio" /> : null}
          </span>
          <span className="opt-icon">
            <Icon name={option.icon} size={18} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="semi t-md">{option.title}</span>
            <span className="text-3 t-xs">{option.detail}</span>
          </span>
        </button>
      ))}
      <p className="text-3 t-xs" style={{ marginTop: 6 }}>
        Payments are encrypted end-to-end. You are only charged once your order is confirmed.
      </p>
    </>
  );
}

/** STEP 4 — Order review and place order. */
export function ReviewStep({
  lines,
  totals,
  deliveryMethod,
  setQuantity,
  placing,
  onPlace,
}: {
  lines: DetailedCartLine[];
  totals: CartTotals;
  deliveryMethod: DeliveryMethod;
  setQuantity: (lineId: string, quantity: number) => void;
  placing: boolean;
  onPlace: () => void;
}) {
  return (
    <>
      <h2 className="section-title">Order Review</h2>
      <div className="stack" style={{ gap: 10 }}>
        {lines.map((line) => (
          <div className="line-item" key={line.lineId}>
            <div className="line-thumb">
              <img
                src={resolveProductImage(
                  line.product,
                  Math.max(0, line.product.colors.findIndex((c) => c.id === line.variantId)),
                )}
                alt={line.product.name}
                loading="lazy"
                width={76}
                height={76}
              />
            </div>
            <div className="line-side">
              <span className="t-sm bold">{line.product.name}</span>
              <span className="text-3 t-xs">{line.variantLabel}</span>
              <div className="line-foot">
                <QuantitySelector
                  value={line.quantity}
                  size="sm"
                  onChange={(q) => setQuantity(line.lineId, q)}
                  max={Math.max(1, line.product.stock)}
                />
                <span className="t-sm semi">{formatPrice(line.lineTotal)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <strong>{formatPrice(totals.subtotal)}</strong>
        </div>
        <div className="summary-row">
          <span>{deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</span>
          <span>{totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery)}</span>
        </div>
        {totals.discount > 0 ? (
          <div className="summary-row">
            <span>Discount</span>
            <span>−{formatPrice(totals.discount)}</span>
          </div>
        ) : null}
        <div className="summary-row summary-total">
          <span>Total</span>
          <span>{formatPrice(totals.total)}</span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        onClick={onPlace}
        disabled={placing}
      >
        {placing ? 'Placing order…' : 'Place Order'}
        {!placing ? <Icon name="check" size={18} strokeWidth={2.2} /> : null}
      </button>
    </>
  );
}
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Icon, { type IconName } from '../components/Icon';
import QuantitySelector from '../components/QuantitySelector';
import { DELIVERY_FEE, PICKUP_FEE, type DetailedCartLine } from '../store/CartContext';
import type { CartTotals, CheckoutForm, DeliveryMethod, PaymentMethod } from '../types';
import { formatPrice } from '../lib/format';
import { resolveProductImage } from '../lib/productImage';

export const DELIVERY_OPTIONS: {
  id: DeliveryMethod;
  title: string;
  detail: string;
  icon: IconName;
  fee: number;
}[] = [
  { id: 'home', title: 'Home Delivery', detail: '2–4 business days nationwide', icon: 'truck', fee: DELIVERY_FEE },
  { id: 'pickup', title: 'Store Pickup', detail: 'Ready in 24h · Lekki store', icon: 'pin', fee: PICKUP_FEE },
];

export const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  title: string;
  detail: string;
  icon: IconName;
}[] = [
  { id: 'card', title: 'Card', detail: 'Visa, Mastercard, Verve', icon: 'card' },
  { id: 'transfer', title: 'Bank Transfer', detail: 'Provia, Opay, Kuda', icon: 'bank' },
  { id: 'wallet', title: 'Mobile Wallet', detail: 'Paga, PalmPay, Airtel', icon: 'wallet' },
];

export const STATES = ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu'];

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

/** STEP 1 — Delivery information. */
export function DeliveryStep({
  form,
  errors,
  setField,
}: {
  form: CheckoutForm;
  errors: Partial<Record<keyof CheckoutForm, string>>;
  setField: (key: keyof CheckoutForm, value: string) => void;
}) {
  return (
    <>
      <h2 className="section-title">Delivery Information</h2>
      <Field id="co-name" label="Full Name" error={errors.name}>
        <input
          id="co-name"
          className="input"
          value={form.name}
          aria-invalid={Boolean(errors.name)}
          placeholder="Eriqk Okoro"
          onChange={(e) => setField('name', e.target.value)}
        />
      </Field>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Field id="co-phone" label="Phone Number" error={errors.phone}>
          <input
            id="co-phone"
            className="input"
            inputMode="tel"
            value={form.phone}
            aria-invalid={Boolean(errors.phone)}
            placeholder="+234 800 000 0000"
            onChange={(e) => setField('phone', e.target.value)}
          />
        </Field>
        <Field id="co-email" label="Email" error={errors.email}>
          <input
            id="co-email"
            className="input"
            inputMode="email"
            value={form.email}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@email.com"
            onChange={(e) => setField('email', e.target.value)}
          />
        </Field>
      </div>
      <Field id="co-address" label="Delivery Address" error={errors.address}>
        <textarea
          id="co-address"
          className="input"
          value={form.address}
          aria-invalid={Boolean(errors.address)}
          placeholder="12 Admiralty Way, Lekki Phase 1"
          onChange={(e) => setField('address', e.target.value)}
        />
      </Field>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Field id="co-city" label="City" error={errors.city}>
          <input
            id="co-city"
            className="input"
            value={form.city}
            aria-invalid={Boolean(errors.city)}
            placeholder="Lekki"
            onChange={(e) => setField('city', e.target.value)}
          />
        </Field>
        <Field id="co-state" label="State" error={errors.state}>
          <select
            id="co-state"
            className="input"
            value={form.state}
            aria-invalid={Boolean(errors.state)}
            onChange={(e) => setField('state', e.target.value)}
          >
            <option value="">Select state</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}