import React from 'react';
import Auth from '@/components/pos/Auth';
import { Helmet } from 'react-helmet-async';

const SignupPage = () => {
  return (
    <>
      <Helmet>
        <title>Sign Up - StorePilot</title>
        <meta name="description" content="Create an account and start your 30-day free trial with StorePilot." />
      </Helmet>
      <Auth mode="signup" />
    </>
  );
};

export default SignupPage;