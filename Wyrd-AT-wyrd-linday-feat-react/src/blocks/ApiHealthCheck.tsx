import React, { useEffect, useState } from 'react';
import { health } from '../api/api';

const ApiHealthCheck: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<string>('Checking...');
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await health.check();
        setApiStatus(`API status: ${response.data}`);
        setIsHealthy(response.data === 'OK');
      } catch (error) {
        setApiStatus('API is unreachable');
        setIsHealthy(false);
      }
    };

    checkHealth();
  }, []);

  return (
    <div className="flex items-center text-sm">
   
    </div>
  );
};

export default ApiHealthCheck;
