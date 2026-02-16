import React from 'react';
import { useOutletContext } from 'react-router-dom';
import DashboardView from '@/components/pos/DashboardView';
import { Helmet } from 'react-helmet-async';

const DashboardPage = () => {
  const { data, handlers } = useOutletContext();

  return (
    <>
      <Helmet>
        <title>Dashboard - StorePilot</title>
        <meta name="description" content="Your main dashboard for sales, inventory, and notifications." />
      </Helmet>
      <DashboardView data={data} handlers={handlers} />
    </>
  );
};

export default DashboardPage;