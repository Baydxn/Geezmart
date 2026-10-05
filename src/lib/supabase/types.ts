/**
 * Convenience aliases over the generated schema types.
 * Regenerate database.types.ts with:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 */
import type { Database } from './database.types';

export type { Database };

export type Json = Database['public']['Tables']['store_settings']['Row']['value'];

export type ProductStatus = Database['public']['Enums']['product_status'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type AppRole = Database['public']['Enums']['app_role'];
export type DiscountKind = Database['public']['Enums']['discount_kind'];
export type AbandonedStage = Database['public']['Enums']['abandoned_stage'];
export type FulfilmentMethod = Database['public']['Enums']['fulfilment_method'];
export type PaymentMethodKind = Database['public']['Enums']['payment_method_kind'];
export type ReviewStatus = Database['public']['Enums']['review_status'];
export type AccountStatus = Database['public']['Enums']['account_status'];

type Tables = Database['public']['Tables'];

export type TableRow<T extends keyof Tables> = Tables[T]['Row'];
export type TableInsert<T extends keyof Tables> = Tables[T]['Insert'];
export type TableUpdate<T extends keyof Tables> = Tables[T]['Update'];
