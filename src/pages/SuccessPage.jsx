import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';

const SuccessPage = () => {
  return (
    <>
      <Helmet>
        <title>Payment Successful - Our Store</title>
        <meta name="description" content="Your payment was successful. Thank you for your order!" />
      </Helmet>
      <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="bg-card p-12 rounded-2xl shadow-2xl max-w-lg w-full border"
        >
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4 text-foreground">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Thank you for your order. We've received your payment and are getting your items ready for you.
          </p>
          <Button asChild size="lg">
            <Link to="/store">
              Continue Shopping <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </>
  );
};

export default SuccessPage;