import React from 'react';
import SignupWizard from '@/components/auth/SignupWizard.jsx';
import { Helmet } from 'react-helmet-async';

const SignupPage = () => {
  return (
    <>
      <Helmet>
        <title>Sign Up - StorePilot</title>
        <meta name="description" content="Create your StorePilot account." />
      </Helmet>
      <SignupWizard />
    </>
  );
};

export default SignupPage;