import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Clock, LogOut, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';

const PendingApprovalPage = ({ status = 'pending', rejectionReason = '' }) => {
  const { signOut } = useAuth();
  const isRejected = status === 'rejected';

  return (
    <>
      <Helmet>
        <title>{isRejected ? 'Account Rejected' : 'Awaiting Approval'} - StorePilot</title>
      </Helmet>
      <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-card rounded-2xl shadow-xl text-center"
        >
          <div className={`inline-block p-4 rounded-2xl ${isRejected ? 'bg-destructive/10' : 'bg-primary/10'}`}>
            {isRejected ? (
              <XCircle className="w-12 h-12 text-destructive" />
            ) : (
              <Clock className="w-12 h-12 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isRejected ? 'Account rejected' : 'Awaiting approval'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isRejected
                ? 'Your account was not approved.'
                : 'Thanks for signing up! An administrator will review your account shortly. You will be able to access the app once approved.'}
            </p>
            {isRejected && rejectionReason && (
              <p className="mt-3 text-sm bg-destructive/10 text-destructive rounded-md p-3">
                Reason: {rejectionReason}
              </p>
            )}
          </div>
          <Button onClick={signOut} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </motion.div>
      </div>
    </>
  );
};

export default PendingApprovalPage;
