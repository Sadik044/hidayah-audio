import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFound: React.FC = () => {
  return (
    <div className="py-20 text-center space-y-4 max-w-md mx-auto">
      <div className="h-16 w-16 rounded-2xl bg-sand-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 mx-auto flex items-center justify-center">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold text-sand-900 dark:text-stone-100">
        পৃষ্ঠাটি পাওয়া যায়নি
      </h1>
      <p className="text-sm text-sand-800/80 dark:text-stone-400">
        আপনি যে লিংকটি খুঁজছেন তা সরানো হয়েছে অথবা লিংকটি সঠিক নয়।
      </p>
      <div className="pt-2">
        <Link to="/">
          <Button variant="primary" size="md" className="gap-2">
            <Home className="h-4 w-4" />
            <span>হোমে ফিরে যান</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};
