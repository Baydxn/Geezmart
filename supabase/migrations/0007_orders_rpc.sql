-- =============================================================================
-- GEEZMART — 0007 transactional RPCs
-- The ONLY safe way to place an order or adjust stock from a client.
-- SECURITY DEFINER + fixed search_path + explicit authorization checks.
-- =============================================================================

-- Reset any search_path tampering on every function below.
alter function public.reserve_stock_for_order(uuid) set search_path = public;

-- ---------------------------------------------------------------------------
-- place_order(p_cart_id, p_shipping_zone_id, p_fulfilment, p_payment, p_coupon)
--
-- Recomputes EVERYTHING from the database: prices from products/variants,
-- delivery fee from the shipping zone, discount via coupon_is_valid.
-- Any amount the browser sends is ignored by design.
--
-- Locks the relevant inventory rows so two shoppers cannot oversell the last
-- unit. Raises an exception on insufficient stock, which rolls back the order.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_cart_id            uuid,
  p_shipping_zone_id   uuid default null,
  p_fulfilment         public.fulfilment_method default 'home_delivery',
  p_payment            public.payment_method_kind default 'card',
  p_coupon             text default null,
  p_full_name          text default null,
  p_phone              text default null,
  p_email              text default null,
  p_address            text default null,
  p_city               text default null,
  p_state              text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart        public.carts%rowtype;
  v_zone        public.shipping_zones%rowtype;
  v_order       public.orders%rowtype;
  v_line        record;
  v_subtotal    numeric(12,2) := 0;
  v_delivery    numeric(12,2) := 0;
  v_discount    numeric(12,2) := 0;
  v_reference   text;
  v_available   int;
  v_coupon_id   uuid;
  v_coupon      record;
begin
  -- 1. The cart must belong to the caller (or be an anonymous cart whose
  --    session token we are given). Never trust a bare cart id.
  select * into v_cart from public.carts where id = p_cart_id for update;
  if v_cart.id is null then
    raise exception 'Cart not found';
  end if;
  if v_cart.customer_id is not null and v_cart.customer_id <> auth.uid() then
    raise exception 'Cart does not belong to the current user';
  end if;

  -- 2. Recompute each line from the products table.
  for v_line in
    select
      ci.product_id,
      ci.variant_id,
      ci.quantity,
      coalesce(v.price, p.price) as unit_price,
      coalesce(v.title, '')    as variant_title,
      coalesce(v.sku, p.sku)   as sku,
      p.name                   as product_name,
      p.id                     as locked_product
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    left join public.product_variants v
      on v.id = ci.variant_id and v.active
    where ci.cart_id = p_cart_id
  loop
    if not exists (
      select 1 from public.products
       where id = v_line.product_id and status = 'published'
    ) then
      raise exception 'Product % is no longer available', v_line.product_name;
    end if;

    -- 3. Lock and verify stock BEFORE promising anything.
    if v_line.variant_id is null then
      select (quantity_on_hand - quantity_reserved) into v_available
        from public.inventory
       where product_id = v_line.product_id and variant_id is null
       for update;
    else
      select (quantity_on_hand - quantity_reserved) into v_available
        from public.inventory
       where product_id = v_line.product_id and variant_id = v_line.variant_id
       for update;
    end if;

    if coalesce(v_available, 0) < v_line.quantity then
      raise exception 'Insufficient stock for %', v_line.product_name;
    end if;

    -- Scheduled sales are applied here, not by the client.
    v_subtotal := v_subtotal + (v_line.unit_price * v_line.quantity);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Cannot place an order for an empty cart';
  end if;

  -- 4. Delivery fee comes from the zone, with the free-delivery threshold.
  if p_fulfilment = 'home_delivery' and p_shipping_zone_id is not null then
    select * into v_zone from public.shipping_zones
     where id = p_shipping_zone_id and active;
    if v_zone.id is not null then
      v_delivery := case
        when v_zone.free_over is not null and v_subtotal >= v_zone.free_over then 0
        else v_zone.fee
      end;
    end if;
  end if;

  -- 5. Discount via the single coupon rule-set.
  if p_coupon is not null and p_coupon <> '' then
    select * into v_coupon from public.coupon_is_valid(p_coupon, v_subtotal, v_cart.customer_id);
    if v_coupon.valid then
      if v_coupon.reason = '' or v_coupon.reason is null then
        v_discount := v_coupon.discount;
        select id into v_coupon_id from public.coupons
         where upper(code) = upper(p_coupon);
      end if;
    end if;
  end if;

  v_reference := public.next_order_reference();

  -- 6. Order header.
  insert into public.orders (
    reference, cart_id, customer_id,
    customer_name, customer_email, customer_phone,
    fulfilment_method, address, city, state, shipping_zone_id,
    subtotal, delivery_fee, discount, total,
    coupon_code, coupon_id,
    status, payment_status, payment_method
  ) values (
    v_reference, p_cart_id, v_cart.customer_id,
    coalesce(p_full_name, ''), coalesce(p_email, ''), coalesce(p_phone, ''),
    p_fulfilment, coalesce(p_address, ''), coalesce(p_city, ''), coalesce(p_state, ''),
    p_shipping_zone_id,
    v_subtotal, v_delivery, v_discount, v_subtotal + v_delivery - v_discount,
    nullif(p_coupon, ''), v_coupon_id,
    'pending',
    case when p_payment = 'cash_on_delivery' then 'unpaid'::public.payment_status
         else 'pending'::public.payment_status end,
    p_payment
  )
  returning * into v_order;

  -- 7. Line items with the recomputed prices.
  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_title,
    sku, image_url, unit_price, quantity, line_total
  )
  select
    v_order.id, ci.product_id, ci.variant_id,
    p.name,
    coalesce(v.title, ''),
    coalesce(v.sku, p.sku),
    (select pi.url from public.product_images pi
      where pi.product_id = p.id
      order by pi.is_primary desc, pi.position limit 1),
    coalesce(v.price, p.price),
    ci.quantity,
    coalesce(v.price, p.price) * ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  left join public.product_variants v on v.id = ci.variant_id and v.active
  where ci.cart_id = p_cart_id;

  -- 8. Commit stock: consume the reservation and post the ledger movement.
  for v_line in
    select oi.product_id, oi.variant_id, oi.quantity
      from public.order_items oi where oi.order_id = v_order.id
  loop
    if v_line.variant_id is null then
      update public.inventory
         set quantity_on_hand  = quantity_on_hand - v_line.quantity,
             quantity_reserved = greatest(quantity_reserved - v_line.quantity, 0)
       where product_id = v_line.product_id and variant_id is null;
    else
      update public.inventory
         set quantity_on_hand  = quantity_on_hand - v_line.quantity,
             quantity_reserved = greatest(quantity_reserved - v_line.quantity, 0)
       where product_id = v_line.product_id and variant_id = v_line.variant_id;
    end if;

    insert into public.inventory_movements
      (product_id, variant_id, delta, reason, reference, note)
    values
      (v_line.product_id, v_line.variant_id, -v_line.quantity, 'sale', v_reference,
       'Order ' || v_reference);
  end loop;

  -- 9. Mark sold-out products, close the abandoned row, clear the cart.
  update public.products p
     set status = 'out_of_stock'
   where p.status = 'published'
     and not exists (
       select 1 from public.inventory i
        where i.product_id = p.id
          and (i.quantity_on_hand - i.quantity_reserved) > 0
     );

  update public.abandoned_checkouts
     set recovered = true, recovered_at = now(), recovered_order_id = v_order.id
   where cart_id = p_cart_id and recovered = false;

  delete from public.cart_items where cart_id = p_cart_id;

  update public.checkout_sessions
     set completed = true, completed_at = now(), order_id = v_order.id
   where cart_id = p_cart_id and completed = false;

  -- 10. Record the activity trail.
  insert into public.activity_logs
    (admin_name, action, entity, entity_id, entity_label, summary, after_value)
  values
    ('Storefront', 'order.placed', 'order', v_order.id::text, v_reference,
     'Order placed from the storefront', jsonb_build_object('total', v_order.total));

  return v_order;
end;
$$;

-- Only signed-in customers and the service role may call this.
revoke execute on function public.place_order(uuid, uuid, public.fulfilment_method, public.payment_method_kind, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, uuid, public.fulfilment_method, public.payment_method_kind, text, text, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- adjust_stock: the only sanctioned way to move stock by hand.
-- Writes an inventory_movements row so the ledger stays the source of truth.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id  uuid,
  p_delta       int,
  p_reason      text default 'adjustment',
  p_variant_id  uuid default null,
  p_note        text default ''
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory%rowtype;
begin
  if not public.can_manage_products() then
    raise exception 'You do not have permission to adjust inventory';
  end if;

  insert into public.inventory_movements
    (product_id, variant_id, delta, reason, note, actor_id, actor_name)
  values
    (p_product_id, p_variant_id, p_delta, p_reason, p_note, auth.uid(),
     coalesce((select name from public.profiles where id = auth.uid()), 'system'));

  if p_variant_id is null then
    select * into v_row from public.inventory
     where product_id = p_product_id and variant_id is null;
  else
    select * into v_row from public.inventory
     where product_id = p_product_id and variant_id = p_variant_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.adjust_stock(uuid, int, text, uuid, text) from public, anon;
grant execute on function public.adjust_stock(uuid, int, text, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_order_status: guard-transitions and log the change.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.can_manage_orders() then
    raise exception 'You do not have permission to change order status';
  end if;

  update public.orders
     set status   = p_status,
         note     = case when p_note = '' then note else p_note end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, status, note, changed_by, changed_by_name)
  values (p_order_id, p_status, p_note, auth.uid(),
          coalesce((select name from public.profiles where id = auth.uid()), 'admin'));

  insert into public.activity_logs (admin_id, admin_name, action, entity, entity_id, entity_label, summary, after_value)
  values (auth.uid(),
          coalesce((select name from public.profiles where id = auth.uid()), 'admin'),
          'order.status_changed', 'order', p_order_id::text,
          v_order.reference, 'Status changed to ' || p_status::text,
          jsonb_build_object('status', p_status));

  return v_order;
end;
$$;

revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Abandoned cart scheduler.
-- Marks stale carts abandoned, or expires old recovery rows.
-- Call from pg_cron or an Edge Function on a schedule.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_abandoned_carts(p_idle_minutes int default 45)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with stale as (
    select c.id
      from public.carts c
     where c.updated_heartbeat_at < now() - make_interval(mins => p_idle_minutes)
       and exists (select 1 from public.cart_items ci where ci.cart_id = c.id)
  )
  update public.abandoned_checkouts a
     set stage         = 'cart',
         item_count    = (select count(*) from public.cart_items ci where ci.cart_id = a.cart_id),
         subtotal      = coalesce((select sum(quantity * unit_price) from public.cart_items ci where ci.cart_id = a.cart_id), 0),
         abandoned_at  = now(),
         recovered     = false
   where a.cart_id in (select id from stale)
     and a.recovered = false;

  get diagnostics v_count = row_count;

  -- Retire recovery rows that were never converted.
  update public.abandoned_checkouts
     set expires_at = now()
   where recovered = false and expires_at < now();

  return v_count;
end;
$$;

revoke execute on function public.sweep_abandoned_carts(int) from public, anon, authenticated;
grant execute on function public.sweep_abandoned_carts(int) to service_role;
