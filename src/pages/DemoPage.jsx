import React from 'react';
import App from '@/App';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

const DemoPage = () => {
  return (
    <>
      <Helmet>
        <title>Demo Store - StorePilot</title>
        <meta name="description" content="Explore a fully-featured, read-only demo of the StorePilot application. No sign-up required." />
      </Helmet>
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 p-2 text-center text-sm font-medium flex items-center justify-center gap-4">
            <Info className="w-5 h-5" />
            <span>You are in a read-only demo environment. Some features are disabled.</span>
            <Button asChild size="sm" className="bg-yellow-900 text-white hover:bg-yellow-800 h-7">
                <Link to="/signup">Start Your Free Trial</Link>
            </Button>
        </div>
        <div className="pt-10">
            <App isDemo={true} />
        </div>
      </div>
    </>
  );
};

export default DemoPage;