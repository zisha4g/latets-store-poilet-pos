import React from 'react';
import Auth from '@/components/pos/Auth';
import { Helmet } from 'react-helmet-async';

const LoginPage = () => {
  return (
    <>
      <Helmet>
        <title>Login - StorePilot</title>
        <meta name="description" content="Log in to your StorePilot account to manage your store." />
      </Helmet>
      <Auth mode="login" />
    </>
  );
};

export default LoginPage;