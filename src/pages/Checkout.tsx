import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';
import { DeliveryStep, PaymentStep, ReviewStep, ShippingStep } from './CheckoutSteps';
import { useCart } from '../store/CartContext';
import { useOrders } from '../store/OrdersContext';
import { useToast } from '../store/ToastContext';
import type { CheckoutForm, OrderLine, PaymentMethod } from '../types';
import { saveCheckoutStep } from '../lib/supabase/storefront';

const STEPS = ['Delivery', 'Shipping', 'Payment', 'Complete'] as const;

const EMPTY_FORM: CheckoutForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
};

export default function Checkout() {
  const { lines, totals, isEmpty, deliveryMethod, setDeliveryMethod, setQuantity, clear } = useCart();
  const { placeOrder } = useOrders();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  // Opening checkout is itself a recovery signal.
  useEffect(() => {
    void saveCheckoutStep(1, {
      fullName: form.name,
      phone: form.phone,
      email: form.email,
    });
    // Intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [placing, setPlacing] = useState(false);

  if (isEmpty && !placing) {
    return (
      <>
        <header className="page-head">
          <h1 className="page-title">Checkout</h1>
        </header>
        <div className="empty">
          <div className="empty-orb">
            <Icon name="bag" size={36} />
          </div>
          <h2>Nothing to check out yet.</h2>
          <p className="text-3 t-md">Add something to your cart first.</p>
          <button type="button" className="btn btn-primary btn-md" onClick={() => navigate('/shop')}>
            Start Shopping
          </button>
        </div>
      </>
    );
  }

  const validateStep1 = () => {
    const next: Partial<Record<keyof CheckoutForm, string>> = {};
    if (!form.name.trim()) next.name = 'Enter your full name';
    if (!/^[+\d][\d\s]{7,}$/.test(form.phone.trim())) next.phone = 'Enter a valid phone number';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    if (!form.address.trim()) next.address = 'Enter your delivery address';
    if (!form.city.trim()) next.city = 'Enter your city';
    if (!form.state) next.state = 'Select your state';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (step === 0 && !validateStep1()) return;
    // Mirror this step into Postgres so it shows up in abandoned-cart recovery.
    void saveCheckoutStep(step + 2, {
      fullName: form.name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      state: form.state,
      fulfilment: deliveryMethod,
      payment,
    });
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const place = () => {
    setPlacing(true);
    const orderLines: OrderLine[] = lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      brand: line.product.brand,
      price: line.product.price,
      quantity: line.quantity,
      variantLabel: line.variantLabel,
      visual: line.product.visual,
      image: line.product.image,
    }));

    // Simulated request — a real backend would POST the same payload here.
    window.setTimeout(() => {
      const order = placeOrder({
        lines: orderLines,
        subtotal: totals.subtotal,
        delivery: totals.delivery,
        discount: totals.discount,
        total: totals.total,
        deliveryMethod,
        paymentMethod: payment,
        customer: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
        },
      });
      clear();
      notify('Order confirmed', 'success');
      navigate(`/order-confirmed/${order.id}`, { replace: true });
    }, 900);
  };

  const panels = [
    <DeliveryStep
      key="delivery"
      form={form}
      errors={errors}
      setField={(key, value) => {
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => ({ ...e, [key]: undefined }));
      }}
    />,
    <ShippingStep key="shipping" value={deliveryMethod} onChange={setDeliveryMethod} />,
    <PaymentStep key="payment" value={payment} onChange={setPayment} />,
    <ReviewStep
      key="review"
      lines={lines}
      totals={totals}
      deliveryMethod={deliveryMethod}
      setQuantity={setQuantity}
      placing={placing}
      onPlace={place}
    />,
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Secure Checkout</p>
          <h1 className="page-title">Checkout</h1>
        </div>
        <span className="chip chip-eyebrow">{totals.itemCount} items</span>
      </header>

      <div>
        <div
          className="steps"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Checkout step ${step + 1} of ${STEPS.length}`}
        >
          {STEPS.map((label, i) => (
            <span className="step-dot" key={label}>
              {i <= step ? (
                <motion.span
                  className="step-dot-fill"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
            </span>
          ))}
        </div>
        <div className="step-labels">
          {STEPS.map((label, i) => (
            <span className="step-label" key={label} data-active={i <= step}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 14, marginTop: 22 }}>
        <AnimatePresence mode="wait">
          <motion.section
            key={STEPS[step]}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="stack-14"
          >
            {panels[step]}
          </motion.section>
        </AnimatePresence>
      </div>

      {step < 3 ? (
        <div className="row" style={{ gap: 10, marginTop: 20 }}>
          {step > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              style={{ flex: 1 }}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <Icon name="chevronLeft" size={17} />
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={goNext}>
            Continue
            <Icon name="arrowRight" size={17} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-lg btn-block"
          style={{ marginTop: 20 }}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <Icon name="chevronLeft" size={17} />
          Back to payment
        </button>
      )}
    </>
  );
}

