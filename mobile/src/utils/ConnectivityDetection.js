import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

const HEALTH_CHECK_URL = 'http://10.0.2.2:5000/health'; // Android emulator localhost
const HEALTH_CHECK_TIMEOUT = 500; // 0.5s timeout

export class ConnectivityManager {
  constructor(backendUrl = HEALTH_CHECK_URL) {
    this.backendUrl = backendUrl;
    this.isOnline = false;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(isOnline) {
    this.listeners.forEach(cb => cb(isOnline));
  }

  async performHealthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const response = await axios.get(this.backendUrl, {
        timeout: HEALTH_CHECK_TIMEOUT,
        validateStatus: (status) => status < 500,
      });

      clearTimeout(timeoutId);
      return response.status === 200;
    } catch (error) {
      console.log('[ConnectivityDetection] Health check failed - entering offline mode', error.message);
      return false;
    }
  }

  async checkConnectivity() {
    // First check if device has network connectivity
    const netState = await NetInfo.fetch();
    
    if (!netState.isConnected) {
      this.isOnline = false;
      this.notifyListeners(false);
      return false;
    }

    // Device has internet, now check backend health
    const backendHealthy = await this.performHealthCheck();
    this.isOnline = backendHealthy;
    this.notifyListeners(backendHealthy);
    
    return backendHealthy;
  }

  async getMode() {
    await this.checkConnectivity();
    return this.isOnline ? 'ONLINE' : 'OFFLINE';
  }
}

// React Hook for connectivity status
export function useConnectivity(backendUrl = HEALTH_CHECK_URL) {
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState('CHECKING');

  useEffect(() => {
    const manager = new ConnectivityManager(backendUrl);

    const unsubscribe = manager.addListener((online) => {
      setIsOnline(online);
      setStatus(online ? 'ONLINE' : 'OFFLINE');
    });

    // Initial check
    manager.checkConnectivity();

    // Check every 5 seconds
    const interval = setInterval(() => {
      manager.checkConnectivity();
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [backendUrl]);

  return { isOnline, status };
}

export default ConnectivityManager;
