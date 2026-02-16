import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AccountingView = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/accounting', { replace: true });
  }, [navigate]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <p className="text-lg animate-pulse">Redirecting to Accounting Module...</p>
    </div>
  );
};

export default AccountingView;