/**
 * Shared Supabase connection indicator.
 * Rendered in the storefront footer and in the admin Settings screen so both
 * halves of GEEZMART surface the backend connection state.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { checkSupabaseConnection, type ConnectionReport } from '../lib/supabase';

export default function SupabaseBadge({ compact = false }: { compact?: boolean }) {
  const [report, setReport] = useState<ConnectionReport | null>(null);

  useEffect(() => {
    let active = true;
    void checkSupabaseConnection().then((result) => {
      if (active) setReport(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!report) return null;

  const tone = report.reachable ? 'solid' : report.configured ? 'warn' : 'quiet';

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-pill supabase-pill"
      data-tone={tone}
      title={report.message}
    >
      <Icon name={report.reachable ? 'shield' : report.configured ? 'refresh' : 'box'} size={11} />
      {compact
        ? report.reachable
          ? 'Supabase'
          : report.configured
            ? 'Connecting'
            : 'Local mode'
        : `Supabase ${report.reachable ? 'connected' : report.configured ? 'unreachable' : 'not configured'}`}
    </motion.span>
  );
}
