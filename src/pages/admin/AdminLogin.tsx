import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshProfile, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('ইমেইল এবং পাসওয়ার্ড দুটিই আবশ্যক।');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.user) {
        throw new Error(authError?.message || 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করুন।');
      }

      // Check profile role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      const userRole = (profile as { role?: string } | null)?.role;
      if (userRole !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('আপনার অ্যাকাউন্টে অ্যাডমিন অধিকার নেই।');
      }

      await refreshProfile();
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লগইন করতে অপ্রত্যাশিত সমস্যা দেখা দিয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-800 text-gold mx-auto flex items-center justify-center shadow-md">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-sand-900 dark:text-stone-100">
          অ্যাডমিন প্রবেশদ্বার
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          হিদায়াহ অডিওর কন্টেন্ট ও সিস্টেম পরিচালনার জন্য লগইন করুন
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="অ্যাডমিন ইমেইল"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hidayahaudio.com"
            icon={<Mail className="h-4 w-4" />}
            required
            autoComplete="email"
          />

          <Input
            label="পাসওয়ার্ড"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            isLoading={loading}
            className="w-full mt-2"
          >
            প্রবেশ করুন
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-stone-400">
        শুধুমাত্র অনুমোদিত অ্যাডমিন ও সম্পাদকদের ব্যবহারের জন্য সংরক্ষিত।
      </p>
    </div>
  );
};
