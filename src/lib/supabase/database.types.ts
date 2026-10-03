/**
 * Mirrors supabase/migrations/*.sql.
 * Regenerate with: npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 */

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      // ---------------------------------------------------------------- profile
      profiles: {
        Row: {
          id: string;
          role: Database['public']['Enums']['app_role'];
          name: string;
          email: string;
          phone: string;
          avatar_url: string | null;
          status: Database['public']['Enums']['account_status'];
          marketing_opt_in: boolean;
          order_count: number;
          total_spent: number;
          last_order_at: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          label: string;
          full_name: string;
          phone: string;
          line1: string;
          line2: string;
          city: string;
          state: string;
          country: string;
          postal_code: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['addresses']['Row']> & {
          customer_id: string;
          full_name: string;
          line1: string;
        };
        Update: Partial<Database['public']['Tables']['addresses']['Row']>;
        Relationships: [];
      };

      // --------------------------------------------------------------- catalogue
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          icon: string;
          tagline: string;
          description: string;
          image_url: string | null;
          hidden: boolean;
          sort_order: number;
          seo_title: string;
          meta_description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['brands']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['brands']['Row']>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sku: string;
          brand_id: string | null;
          category_id: string | null;
          subcategory_id: string | null;
          short_description: string;
          description: string;
          price: number;
          compare_at_price: number | null;
          /** Never exposed to the storefront. */
          cost_price: number | null;
          sale_start: string | null;
          sale_end: string | null;
          sale_price: number | null;
          status: Database['public']['Enums']['product_status'];
          status_reason: string;
          weight_kg: number | null;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          rating_avg: number;
          rating_count: number;
          featured: boolean;
          trending: boolean;
          is_new_drop: boolean;
          mens_pick: boolean;
          seo_title: string;
          meta_description: string;
          focus_keyword: string;
          canonical_url: string | null;
          og_title: string;
          og_description: string;
          og_image_url: string | null;
          sort_order_hint: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']> & {
          name: string;
          slug: string;
          sku: string;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['products']['Row']>;
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          media_id: string | null;
          url: string;
          alt_text: string;
          position: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['product_images']['Row']> & {
          product_id: string;
          url: string;
        };
        Update: Partial<Database['public']['Tables']['product_images']['Row']>;
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          title: string;
          option_name: string;
          option_value: string;
          price: number;
          compare_at_price: number | null;
          image_url: string | null;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['product_variants']['Row']> & {
          product_id: string;
          sku: string;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['product_variants']['Row']>;
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          storage_path: string;
          public_url: string;
          filename: string;
          kind: Database['public']['Enums']['media_kind'];
          mime_type: string;
          byte_size: number;
          width: number | null;
          height: number | null;
          alt_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['media']['Row']> & {
          storage_path: string;
          public_url: string;
          filename: string;
        };
        Update: Partial<Database['public']['Tables']['media']['Row']>;
        Relationships: [];
      };

      // --------------------------------------------------------------- inventory
      inventory: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          quantity_on_hand: number;
          quantity_reserved: number;
          reorder_point: number;
          location: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['inventory']['Row']> & {
          product_id: string;
        };
        Update: Partial<Database['public']['Tables']['inventory']['Row']>;
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          delta: number;
          reason: string;
          reference: string;
          note: string;
          actor_id: string | null;
          actor_name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['inventory_movements']['Row']> & {
          product_id: string;
          delta: number;
        };
        Update: never;
        Relationships: [];
      };

      // ------------------------------------------------------------ cart / checkout
      carts: {
        Row: {
          id: string;
          customer_id: string | null;
          session_token: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
          updated_heartbeat_at: string;
        };
        Insert: Partial<Database['public']['Tables']['carts']['Row']>;
        Update: Partial<Database['public']['Tables']['carts']['Row']>;
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          variant_id: string | null;
          quantity: number;
          unit_price: number;
          added_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cart_items']['Row']> & {
          cart_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: Partial<Database['public']['Tables']['cart_items']['Row']>;
        Relationships: [];
      };
      checkout_sessions: {
        Row: {
          id: string;
          cart_id: string | null;
          customer_id: string | null;
          session_token: string | null;
          current_step: number;
          full_name: string;
          phone: string;
          email: string;
          address: string;
          city: string;
          state: string;
          fulfilment_method: Database['public']['Enums']['fulfilment_method'];
          shipping_zone_id: string | null;
          payment_method: Database['public']['Enums']['payment_method_kind'];
          payment_reference: string;
          subtotal: number;
          delivery_fee: number;
          discount: number;
          total: number;
          coupon_code: string | null;
          completed: boolean;
          completed_at: string | null;
          order_id: string | null;
          started_at: string;
          last_active_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['checkout_sessions']['Row']>;
        Update: Partial<Database['public']['Tables']['checkout_sessions']['Row']>;
        Relationships: [];
      };
      abandoned_checkouts: {
        Row: {
          id: string;
          cart_id: string | null;
          customer_id: string | null;
          session_token: string | null;
          email: string;
          phone: string;
          stage: Database['public']['Enums']['abandoned_stage'];
          furthest_step: number;
          items: Json;
          item_count: number;
          subtotal: number;
          full_name: string;
          address: string;
          city: string;
          state: string;
          fulfilment_method: Database['public']['Enums']['fulfilment_method'] | null;
          payment_method: Database['public']['Enums']['payment_method_kind'] | null;
          recovered: boolean;
          recovered_at: string | null;
          recovered_order_id: string | null;
          reminder_sent_at: string | null;
          reminder_count: number;
          discount_code: string;
          abandoned_at: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['abandoned_checkouts']['Row']>;
        Update: Partial<Database['public']['Tables']['abandoned_checkouts']['Row']>;
        Relationships: [];
      };

      // ------------------------------------------------------------ orders / money
      orders: {
        Row: {
          id: string;
          reference: string;
          cart_id: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          fulfilment_method: Database['public']['Enums']['fulfilment_method'];
          address: string;
          city: string;
          state: string;
          shipping_zone_id: string | null;
          subtotal: number;
          delivery_fee: number;
          discount: number;
          total: number;
          coupon_code: string | null;
          coupon_id: string | null;
          status: Database['public']['Enums']['order_status'];
          payment_status: Database['public']['Enums']['payment_status'];
          payment_method: Database['public']['Enums']['payment_method_kind'];
          note: string;
          cancel_reason: string;
          placed_at: string;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['orders']['Row']>;
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name: string;
          variant_title: string;
          sku: string;
          image_url: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['order_items']['Row']> & {
          order_id: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          line_total: number;
        };
        Update: never;
        Relationships: [];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          status: Database['public']['Enums']['order_status'];
          note: string;
          changed_by: string | null;
          changed_by_name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['order_status_history']['Row']> & {
          order_id: string;
          status: Database['public']['Enums']['order_status'];
        };
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          method: Database['public']['Enums']['payment_method_kind'];
          amount: number;
          status: Database['public']['Enums']['payment_status'];
          reference: string;
          provider: string;
          raw_response: Json;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & {
          order_id: string;
          method: Database['public']['Enums']['payment_method_kind'];
          amount: number;
        };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          carrier: string;
          tracking_number: string;
          tracking_url: string;
          status: Database['public']['Enums']['order_status'];
          shipped_at: string | null;
          estimated_delivery: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shipments']['Row']> & {
          order_id: string;
        };
        Update: Partial<Database['public']['Tables']['shipments']['Row']>;
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string;
          kind: Database['public']['Enums']['discount_kind'];
          value: number;
          max_discount: number | null;
          min_order_value: number;
          usage_limit: number | null;
          used_count: number;
          per_customer_limit: number | null;
          starts_at: string | null;
          expires_at: string | null;
          active: boolean;
          category_ids: string[];
          product_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['coupons']['Row']> & {
          code: string;
          kind: Database['public']['Enums']['discount_kind'];
          value: number;
        };
        Update: Partial<Database['public']['Tables']['coupons']['Row']>;
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          id: string;
          coupon_id: string;
          order_id: string | null;
          customer_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['coupon_redemptions']['Row']> & {
          coupon_id: string;
        };
        Update: never;
        Relationships: [];
      };
      shipping_zones: {
        Row: {
          id: string;
          name: string;
          kind: Database['public']['Enums']['fulfilment_method'];
          states: string[];
          fee: number;
          free_over: number | null;
          eta_min_days: number;
          eta_max_days: number;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shipping_zones']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['shipping_zones']['Row']>;
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          id: string;
          zone_id: string;
          name: string;
          description: string;
          price: number;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shipping_rates']['Row']> & {
          zone_id: string;
          name: string;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['shipping_rates']['Row']>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['payment_method_kind'];
          label: string;
          description: string;
          instructions: string;
          icon: string;
          provider_key_env: string;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payment_methods']['Row']> & {
          kind: Database['public']['Enums']['payment_method_kind'];
          label: string;
        };
        Update: Partial<Database['public']['Tables']['payment_methods']['Row']>;
        Relationships: [];
      };

      // ------------------------------------------------------------------ content
      banners: {
        Row: {
          id: string;
          headline: string;
          subheadline: string;
          description: string;
          cta_text: string;
          cta_href: string;
          image_desktop: string | null;
          image_mobile: string | null;
          image_url: string | null;
          start_date: string | null;
          end_date: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['banners']['Row']> & { headline: string };
        Update: Partial<Database['public']['Tables']['banners']['Row']>;
        Relationships: [];
      };
      homepage_sections: {
        Row: {
          id: string;
          key: string;
          label: string;
          title: string;
          subtitle: string;
          description: string;
          cta_text: string;
          cta_href: string;
          enabled: boolean;
          sort_order: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['homepage_sections']['Row']> & {
          key: string;
          label: string;
        };
        Update: Partial<Database['public']['Tables']['homepage_sections']['Row']>;
        Relationships: [];
      };
      homepage_section_products: {
        Row: {
          id: string;
          section_id: string;
          product_id: string;
          position: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['homepage_section_products']['Row']> & {
          section_id: string;
          product_id: string;
        };
        Update: Partial<Database['public']['Tables']['homepage_section_products']['Row']>;
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          title: string;
          slug: string;
          body: string;
          excerpt: string;
          published: boolean;
          show_in_footer: boolean;
          sort_order: number;
          seo_title: string;
          meta_description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['pages']['Row']> & {
          title: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['pages']['Row']>;
        Relationships: [];
      };
      navigation_items: {
        Row: {
          id: string;
          location: string;
          label: string;
          href: string;
          icon: string;
          sort_order: number;
          hidden: boolean;
          system_route: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['navigation_items']['Row']> & {
          label: string;
          href: string;
        };
        Update: Partial<Database['public']['Tables']['navigation_items']['Row']>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          customer_id: string | null;
          author_name: string;
          rating: number;
          title: string;
          body: string;
          status: Database['public']['Enums']['review_status'];
          is_verified: boolean;
          helpful_count: number;
          admin_note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['reviews']['Row']> & {
          product_id: string;
          rating: number;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
        Relationships: [];
      };
      store_settings: {
        Row: {
          key: string;
          value: Json;
          group_name: string;
          label: string;
          is_secret: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['store_settings']['Row']> & { key: string };
        Update: Partial<Database['public']['Tables']['store_settings']['Row']>;
        Relationships: [];
      };

      // ----------------------------------------------------------------------- ops
      notifications: {
        Row: {
          id: string;
          recipient_id: string | null;
          audience: string;
          type: string;
          severity: Database['public']['Enums']['log_severity'];
          title: string;
          body: string;
          link: string;
          entity: string;
          entity_id: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          type: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          admin_name: string;
          action: string;
          entity: string;
          entity_id: string;
          entity_label: string;
          summary: string;
          before_value: Json | null;
          after_value: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['activity_logs']['Row']> & {
          action: string;
          entity: string;
        };
        Update: never;
        Relationships: [];
      };
      wishlists: {
        Row: { id: string; customer_id: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['wishlists']['Row']> & { customer_id: string };
        Update: never;
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          id: string;
          wishlist_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['wishlist_items']['Row']> & {
          wishlist_id: string;
          product_id: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      storefront_catalog: { Row: Record<string, unknown>; Relationships: [] };
      inventory_available: { Row: Record<string, unknown>; Relationships: [] };
      admin_daily_sales: { Row: Record<string, unknown>; Relationships: [] };
      admin_top_products: { Row: Record<string, unknown>; Relationships: [] };
      admin_top_categories: { Row: Record<string, unknown>; Relationships: [] };
      admin_cart_health: { Row: Record<string, unknown>; Relationships: [] };
      admin_inventory_alerts: { Row: Record<string, unknown>; Relationships: [] };
    };
    Functions: {
      coupon_is_valid: {
        Args: { p_code: string; p_subtotal: number; p_customer: string | null };
        Returns: { valid: boolean; reason: string; discount: number }[];
      };
      next_order_reference: { Args: Record<PropertyKey, never>; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      has_role: { Args: { roles: Database['public']['Enums']['app_role'][] }; Returns: boolean };
      my_role: { Args: Record<PropertyKey, never>; Returns: Database['public']['Enums']['app_role'] };
      can_manage_products: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_manage_orders: { Args: Record<PropertyKey, never>; Returns: boolean };
      effective_price: { Args: { p_product: unknown }; Returns: number };
    };
    Enums: {
      app_role: 'customer' | 'super_admin' | 'admin' | 'product_manager' | 'order_manager' | 'support';
      account_status: 'active' | 'suspended' | 'deleted';
      product_status: 'draft' | 'published' | 'hidden' | 'out_of_stock' | 'coming_soon';
      order_status:
        | 'pending' | 'confirmed' | 'processing' | 'shipped'
        | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded';
      payment_status:
        | 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
      payment_method_kind:
        | 'card' | 'bank_transfer' | 'ussd' | 'cash_on_delivery' | 'wallet';
      discount_kind: 'percentage' | 'fixed_amount' | 'free_delivery';
      fulfilment_method: 'home_delivery' | 'pickup';
      review_status: 'pending' | 'approved' | 'hidden' | 'rejected';
      abandoned_stage:
        | 'cart' | 'checkout_step_1' | 'checkout_step_2'
        | 'checkout_step_3' | 'payment_pending';
      media_kind:
        | 'product' | 'banner' | 'category' | 'page' | 'avatar' | 'social' | 'other';
      log_severity: 'info' | 'warning' | 'critical';
    };
  };
};
